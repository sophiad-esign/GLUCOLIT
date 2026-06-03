#!/usr/bin/env python3
"""Create GLUCOLIT draft articles from scholarly metadata.

This monitor intentionally avoids scraping paywalled publisher pages. It uses
PubMed as the primary discovery source, Europe PMC as an abstract/open-access
metadata supplement, and Unpaywall to find legal open-access full-text links.
Generated posts stay as draft: true until manually reviewed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = REPO_ROOT / "packages/cms/src/collections/blog/content"
STATE_PATH = REPO_ROOT / "data/glucolit-rss-state.json"

THUMBNAIL = (
    "https://images.unsplash.com/photo-1576671081837-49000212a370"
    "?q=80&w=1800&auto=format&fit=crop"
)

JOURNALS = [
    ("The Lancet Diabetes & Endocrinology", '"Lancet Diabetes Endocrinol"[Journal]'),
    ("Nature Metabolism", '"Nat Metab"[Journal]'),
    ("Nature Medicine", '"Nat Med"[Journal]'),
    ("Cell Metabolism", '"Cell Metab"[Journal]'),
    ("Diabetes Care", '"Diabetes Care"[Journal]'),
    ("Diabetes", '"Diabetes"[Journal]'),
    ("Diabetologia", '"Diabetologia"[Journal]'),
    ("JAMA", '"JAMA"[Journal]'),
    ("JAMA Internal Medicine", '"JAMA Intern Med"[Journal]'),
    ("NEJM", '"N Engl J Med"[Journal]'),
    ("BMJ", '"BMJ"[Journal]'),
    ("Annals of Internal Medicine", '"Ann Intern Med"[Journal]'),
    ("Circulation", '"Circulation"[Journal]'),
    ("American Journal of Clinical Nutrition", '"Am J Clin Nutr"[Journal]'),
    ("Obesity", '"Obesity (Silver Spring)"[Journal]'),
    ("BMC Medicine", '"BMC Med"[Journal]'),
    ("PLOS Medicine", '"PLoS Med"[Journal]'),
]

TOPIC_QUERY = (
    '("prediabetic state"[MeSH Terms] OR prediabetes OR prediabetic OR '
    '"impaired fasting glucose" OR "impaired glucose tolerance" OR '
    '"insulin resistance" OR "insulin sensitivity" OR "diabetes prevention" OR '
    '"lifestyle intervention" OR "lifestyle modification" OR '
    '"National Diabetes Prevention Program" OR diet OR nutrition OR exercise OR '
    '"physical activity" OR "weight loss" OR sleep OR "metabolic syndrome")'
)

POSITIVE_KEYWORDS = {
    "prediabetes": 7,
    "pre-diabetes": 7,
    "pre diabetes": 7,
    "prediabetic": 6,
    "impaired fasting glucose": 7,
    "impaired glucose tolerance": 7,
    "insulin resistance": 7,
    "insulin sensitivity": 5,
    "type 2 diabetes prevention": 6,
    "diabetes prevention": 6,
    "lifestyle intervention": 6,
    "lifestyle modification": 6,
    "national diabetes prevention program": 6,
    "weight loss": 4,
    "diet": 3,
    "nutrition": 3,
    "exercise": 4,
    "physical activity": 4,
    "sleep": 3,
    "metabolic syndrome": 4,
    "glucose": 2,
    "glycaemic": 2,
    "glycemic": 2,
    "hba1c": 3,
    "continuous glucose": 3,
    "remission": 3,
}

NEGATIVE_KEYWORDS = {
    "type 1 diabetes": -5,
    "gestational diabetes": -3,
    "diabetic ketoacidosis": -4,
    "retinopathy": -2,
    "nephropathy": -2,
}

ARTICLE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "title_en": {"type": "string"},
        "title_zh": {"type": "string"},
        "description_en": {"type": "string"},
        "description_zh": {"type": "string"},
        "plain_en": {"type": "string"},
        "plain_zh": {"type": "string"},
        "takeaways_en": {"type": "array", "items": {"type": "string"}},
        "takeaways_zh": {"type": "array", "items": {"type": "string"}},
        "why_relevant_en": {"type": "string"},
        "why_relevant_zh": {"type": "string"},
    },
    "required": [
        "title_en",
        "title_zh",
        "description_en",
        "description_zh",
        "plain_en",
        "plain_zh",
        "takeaways_en",
        "takeaways_zh",
        "why_relevant_en",
        "why_relevant_zh",
    ],
}

LLM_ERRORS: list[str] = []


@dataclass
class LLMConfig:
    provider: str
    api_key: str
    base_url: str
    model: str
    supports_responses: bool
    strict_json_schema: bool


@dataclass
class PaperItem:
    source: str
    title: str
    link: str
    summary: str
    published_at: str
    pmid: str = ""
    doi: str = ""
    oa_url: str = ""
    evidence: str = "PubMed abstract"


def fetch_text(url: str, timeout: int = 30, accept: str = "application/json,*/*") -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "GLUCOLIT literature monitor/1.0 (+https://glucolit.vercel.app)",
            "Accept": accept,
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def strip_html(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<(script|style).*?</\1>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def pubmed_url(path: str, params: dict[str, str]) -> str:
    return f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/{path}?" + urllib.parse.urlencode(
        params
    )


def parse_pubmed_date(article: ET.Element) -> str:
    year = article.findtext(".//PubDate/Year", default="")
    medline = article.findtext(".//PubDate/MedlineDate", default="")
    if not year and medline:
        match = re.search(r"\b(19|20)\d{2}\b", medline)
        year = match.group(0) if match else ""
    month = article.findtext(".//PubDate/Month", default="01")
    day = article.findtext(".//PubDate/Day", default="01")
    month_number = month if month.isdigit() else str(
        {
            "Jan": 1,
            "Feb": 2,
            "Mar": 3,
            "Apr": 4,
            "May": 5,
            "Jun": 6,
            "Jul": 7,
            "Aug": 8,
            "Sep": 9,
            "Oct": 10,
            "Nov": 11,
            "Dec": 12,
        }.get(month[:3], 1)
    )
    return f"{year or dt.date.today().year}-{int(month_number):02d}-{int(day):02d}"


def normalize_doi(value: str) -> str:
    value = strip_html(value).strip().rstrip(".")
    value = re.sub(r"^https?://(dx\.)?doi\.org/", "", value, flags=re.I)
    return value


def article_doi(article: ET.Element) -> str:
    for node in article.findall(".//ArticleId"):
        if node.attrib.get("IdType", "").lower() == "doi" and node.text:
            return normalize_doi(node.text)
    for node in article.findall(".//ELocationID"):
        if node.attrib.get("EIdType", "").lower() == "doi" and node.text:
            return normalize_doi(node.text)
    return ""


def parse_pubmed_articles(xml_text: str, requested_source: str) -> list[PaperItem]:
    root = ET.fromstring(xml_text)
    papers: list[PaperItem] = []
    for article in root.findall(".//PubmedArticle"):
        pmid = "".join(article.findtext(".//PMID", default="").split())
        title_node = article.find(".//ArticleTitle")
        title = strip_html("".join(title_node.itertext())) if title_node is not None else ""
        abstract_parts = [
            strip_html("".join(node.itertext())) for node in article.findall(".//AbstractText")
        ]
        abstract = " ".join(part for part in abstract_parts if part)
        journal = article.findtext(".//Journal/Title", default=requested_source)
        doi = article_doi(article)
        link = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else (
            f"https://doi.org/{doi}" if doi else ""
        )
        if title and link:
            papers.append(
                PaperItem(
                    source=f"{requested_source} via PubMed ({journal})",
                    title=title,
                    link=link,
                    summary=abstract,
                    published_at=parse_pubmed_date(article),
                    pmid=pmid,
                    doi=doi,
                )
            )
    return papers


def search_pubmed(source: str, journal_query: str, limit: int) -> list[PaperItem]:
    search_url = pubmed_url(
        "esearch.fcgi",
        {
            "db": "pubmed",
            "retmode": "json",
            "retmax": str(limit),
            "sort": "pub date",
            "term": f"({journal_query}) AND {TOPIC_QUERY}",
        },
    )
    search = json.loads(fetch_text(search_url))
    ids = search.get("esearchresult", {}).get("idlist", [])
    if not ids:
        return []
    fetch_url = pubmed_url(
        "efetch.fcgi",
        {"db": "pubmed", "retmode": "xml", "id": ",".join(ids)},
    )
    return parse_pubmed_articles(fetch_text(fetch_url, accept="text/xml,*/*"), source)


def europe_pmc_metadata(paper: PaperItem) -> dict[str, Any]:
    terms: list[str] = []
    if paper.pmid:
        terms.append(f"EXT_ID:{paper.pmid} AND SRC:MED")
    if paper.doi:
        terms.append(f'DOI:"{paper.doi}"')
    for term in terms:
        url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode(
            {
                "query": term,
                "format": "json",
                "resultType": "core",
                "pageSize": "1",
            }
        )
        try:
            data = json.loads(fetch_text(url, timeout=8))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            continue
        results = data.get("resultList", {}).get("result", [])
        if results:
            return results[0]
    return {}


def best_europe_pmc_url(metadata: dict[str, Any]) -> str:
    urls = metadata.get("fullTextUrlList", {}).get("fullTextUrl", [])
    if isinstance(urls, dict):
        urls = [urls]
    for entry in urls:
        url = entry.get("url", "")
        availability = entry.get("availability", "")
        if url and availability.lower() in {"free", "open access"}:
            return url
    for entry in urls:
        if entry.get("url"):
            return entry["url"]
    return ""


def unpaywall_oa_url(doi: str) -> str:
    if not doi:
        return ""
    email = os.getenv("UNPAYWALL_EMAIL", "contact@glucolit.vercel.app")
    url = f"https://api.unpaywall.org/v2/{urllib.parse.quote(doi)}?" + urllib.parse.urlencode(
        {"email": email}
    )
    try:
        data = json.loads(fetch_text(url, timeout=8))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return ""
    best = data.get("best_oa_location") or {}
    return best.get("url_for_pdf") or best.get("url") or ""


def enrich_paper(paper: PaperItem) -> PaperItem:
    metadata = europe_pmc_metadata(paper)
    europe_abstract = strip_html(metadata.get("abstractText", ""))
    if europe_abstract and len(europe_abstract) > len(paper.summary):
        paper.summary = europe_abstract
        paper.evidence = "Europe PMC abstract"
    if not paper.doi and metadata.get("doi"):
        paper.doi = normalize_doi(metadata["doi"])
    paper.oa_url = best_europe_pmc_url(metadata) or unpaywall_oa_url(paper.doi)
    if paper.oa_url:
        paper.evidence += " + open-access full-text link"
    return paper


def relevance_score(title: str, summary: str) -> tuple[int, list[str]]:
    text = f"{title} {summary}".lower()
    score = 0
    matched: list[str] = []
    for keyword, weight in POSITIVE_KEYWORDS.items():
        if keyword in text:
            score += weight
            matched.append(keyword)
    for keyword, weight in NEGATIVE_KEYWORDS.items():
        if keyword in text:
            score += weight
    return score, matched


def stable_id(link: str, title: str) -> str:
    return hashlib.sha256((link or title).encode("utf-8")).hexdigest()[:16]


def slugify(title: str, item_id: str) -> str:
    normalized = title.lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    normalized = normalized[:72].strip("-") or "research-note"
    return f"{normalized}-{item_id[:8]}"


def md_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').strip()


def yaml_list(values: list[str]) -> str:
    return "[" + ", ".join(values) + "]"


def build_prompt(paper: PaperItem, matched: list[str]) -> str:
    return textwrap.dedent(
        f"""
        You are writing for GLUCOLIT, a public education site for people with
        prediabetes, insulin resistance, and early metabolic risk.

        Create a bilingual plain-language article from the evidence below.
        Use only the title, abstract, source metadata, DOI/link, and open-access
        link if provided. Do not invent sample size, methods, results, or
        causality that are not in the evidence.

        Style:
        - Chinese: warm, clear, useful, ordinary-reader language, not academic.
        - English: faithful plain-language version of the same meaning.
        - Explain what the study suggests, what it does not prove, and what a
          cautious reader can take away.
        - No personal medical advice.

        Return strict JSON with:
        title_en, title_zh, description_en, description_zh,
        plain_en, plain_zh, takeaways_en, takeaways_zh,
        why_relevant_en, why_relevant_zh.

        Source: {paper.source}
        Title: {paper.title}
        PMID: {paper.pmid}
        DOI: {paper.doi}
        Link: {paper.link}
        Open-access link if available: {paper.oa_url}
        Evidence type: {paper.evidence}
        Published date: {paper.published_at}
        Matched relevance keywords: {", ".join(matched)}

        Abstract/evidence:
        {paper.summary[:5000]}
        """
    ).strip()


def llm_config() -> LLMConfig | None:
    kimi_key = os.getenv("KIMI_API_KEY")
    if kimi_key:
        return LLMConfig(
            provider="Kimi",
            api_key=kimi_key,
            base_url=os.getenv("KIMI_BASE_URL", "https://api.moonshot.ai/v1").rstrip("/"),
            model=os.getenv("KIMI_MODEL", "kimi-k2.6"),
            supports_responses=False,
            strict_json_schema=False,
        )

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        return LLMConfig(
            provider="OpenAI",
            api_key=openai_key,
            base_url="https://api.openai.com/v1",
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            supports_responses=True,
            strict_json_schema=True,
        )

    LLM_ERRORS.append("KIMI_API_KEY or OPENAI_API_KEY is missing")
    return None


def chat_response_format(config: LLMConfig) -> dict[str, Any]:
    if config.strict_json_schema:
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "glucolit_article",
                "strict": True,
                "schema": ARTICLE_SCHEMA,
            },
        }
    return {"type": "json_object"}


def call_chat_completion(config: LLMConfig, prompt: str) -> dict[str, Any] | None:

    payload = {
        "model": config.model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a precise bilingual medical research explainer. "
                    "Return only JSON that matches the requested schema."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 2200,
        "response_format": chat_response_format(config),
    }
    request = urllib.request.Request(
        f"{config.base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1200]
        message = f"{config.provider} chat HTTP {exc.code}: {body}"
        LLM_ERRORS.append(message)
        print(f"LLM generation failed: {message}")
        return None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        message = f"{config.provider} chat: {exc}"
        LLM_ERRORS.append(message)
        print(f"LLM generation failed: {message}")
        return None

    output_text = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    try:
        return json.loads(output_text)
    except (TypeError, json.JSONDecodeError):
        LLM_ERRORS.append(f"{config.provider} chat returned non-JSON output")
        print("LLM generation returned non-JSON output.")
        return None


def call_openai_responses_fallback(config: LLMConfig, prompt: str) -> dict[str, Any] | None:
    if not config.supports_responses:
        return None

    payload = {
        "model": config.model,
        "input": prompt,
        "max_output_tokens": 2200,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "glucolit_article",
                "strict": True,
                "schema": ARTICLE_SCHEMA,
            }
        },
    }
    request = urllib.request.Request(
        f"{config.base_url}/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1200]
        message = f"Responses fallback HTTP {exc.code}: {body}"
        LLM_ERRORS.append(message)
        print(f"LLM generation failed: {message}")
        return None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        message = f"Responses fallback: {exc}"
        LLM_ERRORS.append(message)
        print(f"LLM generation failed: {message}")
        return None

    output_text = data.get("output_text")
    if not output_text:
        chunks: list[str] = []
        for item in data.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in {"output_text", "text"}:
                    chunks.append(content.get("text", ""))
        output_text = "\n".join(chunks)
    try:
        return json.loads(output_text)
    except (TypeError, json.JSONDecodeError):
        LLM_ERRORS.append("Responses fallback returned non-JSON output")
        print("LLM generation returned non-JSON output.")
        return None


def generate_article(prompt: str) -> dict[str, Any] | None:
    config = llm_config()
    if config is None:
        return None
    article = call_chat_completion(config, prompt)
    if article is not None:
        return article
    return call_openai_responses_fallback(config, prompt)


def is_valid_article(article: dict[str, Any] | None) -> bool:
    if not article:
        return False
    required = [
        "title_en",
        "title_zh",
        "description_en",
        "description_zh",
        "plain_en",
        "plain_zh",
        "why_relevant_en",
        "why_relevant_zh",
    ]
    if any(not str(article.get(key, "")).strip() for key in required):
        return False
    plain_text = f"{article.get('plain_en', '')}\n{article.get('plain_zh', '')}"
    blocked = [
        "This item appears relevant",
        "automated screening result",
        "Matched keywords",
        "system selected",
        "被系统选中",
        "命中关键词",
    ]
    if any(phrase in plain_text for phrase in blocked):
        return False
    if len(str(article.get("plain_en", ""))) < 450:
        return False
    if len(str(article.get("plain_zh", ""))) < 220:
        return False
    return len(article.get("takeaways_en", [])) >= 2 and len(
        article.get("takeaways_zh", [])
    ) >= 2


def bullet_list(items: list[str]) -> str:
    return "\n".join(f"- {item.strip()}" for item in items if item.strip())


def article_to_mdx(paper: PaperItem, article: dict[str, Any], status: str, draft: bool) -> str:
    title = f"{article['title_zh']} / {article['title_en']}"
    description = f"{article['description_zh']} {article['description_en']}"
    doi_line = f"- DOI: [{paper.doi}](https://doi.org/{paper.doi})\n" if paper.doi else ""
    oa_line = f"- Open-access link: [{paper.oa_url}]({paper.oa_url})\n" if paper.oa_url else ""
    return textwrap.dedent(
        f"""\
        ---
        title: "{md_escape(title[:180])}"
        description: "{md_escape(description[:260])}"
        publishedAt: {paper.published_at}
        tags: {yaml_list(["medical-research", "prediabetes", "lifestyle"])}
        thumbnail: {THUMBNAIL}
        status: {status}
        draft: {str(draft).lower()}
        ---

        > 本文由 GLUCOLIT 根据 PubMed/Europe PMC/Unpaywall 可访问的题录、摘要和开放获取信息生成，仅供科普参考，不构成医疗建议。如有健康问题，请咨询专业医生。

        ## 中文白话版

        {article["plain_zh"].strip()}

        ### 为什么和糖尿病前期有关？

        {article["why_relevant_zh"].strip()}

        ### 你可以带走的重点

        {bullet_list(article.get("takeaways_zh", []))}

        ## English Plain-Language Version

        {article["plain_en"].strip()}

        ### Why This Matters for Prediabetes

        {article["why_relevant_en"].strip()}

        ### Practical Takeaways

        {bullet_list(article.get("takeaways_en", []))}

        ## Source

        - Journal/source: {paper.source}
        - Evidence used: {paper.evidence}
        - Original title: {paper.title}
        - PubMed: [{paper.link}]({paper.link})
        {doi_line}{oa_line}- Published or indexed date: {paper.published_at}
        """
    )


def load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"items": {}}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_article(paper: PaperItem, item_id: str, article: dict[str, Any], status: str, draft: bool) -> Path:
    slug = slugify(paper.title, item_id)
    post_dir = CONTENT_ROOT / slug
    post_dir.mkdir(parents=True, exist_ok=True)
    post_path = post_dir / "en.mdx"
    post_path.write_text(article_to_mdx(paper, article, status, draft), encoding="utf-8")
    return post_path


def candidate_papers(limit_per_journal: int) -> list[PaperItem]:
    papers: list[PaperItem] = []
    seen: set[str] = set()
    for source, journal_query in JOURNALS:
        print(f"Searching PubMed: {source}")
        try:
            source_papers = search_pubmed(source, journal_query, limit_per_journal)
        except Exception as exc:  # noqa: BLE001
            print(f"PubMed search failed for {source}: {exc}")
            continue
        for paper in source_papers:
            item_id = stable_id(paper.link, paper.title)
            if item_id in seen:
                continue
            seen.add(item_id)
            papers.append(paper)
            time.sleep(0.1)
    return papers


def run(args: argparse.Namespace) -> int:
    if args.require_openai and not (os.getenv("KIMI_API_KEY") or os.getenv("OPENAI_API_KEY")):
        print("KIMI_API_KEY or OPENAI_API_KEY is missing.")
        return 1

    state = load_state()
    created: list[Path] = []
    created_count = 0
    scanned = 0
    skipped_score = 0
    skipped_no_abstract = 0
    skipped_openai = 0
    skipped_quality = 0

    for paper in candidate_papers(args.limit_per_feed):
        if args.max_created is not None and created_count >= args.max_created:
            print(f"Reached max-created={args.max_created}; stopping.")
            break

        scanned += 1
        item_id = stable_id(paper.link, paper.title)
        existing = state["items"].get(item_id)
        if existing and existing.get("generated"):
            continue

        score, matched = relevance_score(paper.title, paper.summary)
        attempts = int(existing.get("attempts", 0)) if existing else 0
        state["items"][item_id] = {
            "title": paper.title,
            "source": paper.source,
            "link": paper.link,
            "pmid": paper.pmid,
            "doi": paper.doi,
            "oa_url": paper.oa_url,
            "evidence": paper.evidence,
            "published_at": paper.published_at,
            "score": score,
            "matched": matched,
            "created_at": existing.get("created_at") if existing else dt.datetime.now(dt.UTC).isoformat(),
            "last_seen_at": dt.datetime.now(dt.UTC).isoformat(),
            "attempts": attempts,
            "generated": False,
        }

        if len(paper.summary) < args.min_abstract_chars:
            print(f"Skip no usable abstract: {paper.title}")
            state["items"][item_id]["skip_reason"] = "missing or too-short abstract"
            skipped_no_abstract += 1
            continue
        if score < args.min_score:
            print(f"Skip score={score}: {paper.title}")
            state["items"][item_id]["skip_reason"] = f"score {score} below min-score {args.min_score}"
            skipped_score += 1
            continue

        paper = enrich_paper(paper)
        state["items"][item_id]["doi"] = paper.doi
        state["items"][item_id]["oa_url"] = paper.oa_url
        state["items"][item_id]["evidence"] = paper.evidence
        state["items"][item_id]["attempts"] = attempts + 1
        if args.dry_run and not os.getenv("OPENAI_API_KEY"):
            print(f"Would create score={score}: {paper.title}")
            created_count += 1
            continue

        article = generate_article(build_prompt(paper, matched))
        if article is None:
            print(f"Skip because OpenAI did not return an article: {paper.title}")
            state["items"][item_id]["skip_reason"] = "OpenAI did not return an article"
            skipped_openai += 1
            continue
        if not is_valid_article(article):
            print(f"Skip incomplete generated article: {paper.title}")
            state["items"][item_id]["skip_reason"] = "generated article failed quality gate"
            skipped_quality += 1
            continue
        if args.dry_run:
            print(f"Would create score={score}: {paper.title}")
            created_count += 1
            continue

        path = write_article(paper, item_id, article, args.status, args.draft)
        created.append(path)
        created_count += 1
        state["items"][item_id]["generated"] = True
        state["items"][item_id]["path"] = str(path.relative_to(REPO_ROOT))
        state["items"][item_id].pop("skip_reason", None)
        print(f"Created {path.relative_to(REPO_ROOT)}")
        time.sleep(args.sleep)

    if not args.dry_run:
        save_state(state)
    reported_created = created_count if args.dry_run else len(created)
    print(f"Scanned {scanned} candidate papers, created {reported_created} article(s).")
    summary_path = os.getenv("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary_file:
            summary_file.write(
                "\n### Run result\n\n"
                f"- Scanned candidate papers: {scanned}\n"
                f"- Created draft articles: {reported_created}\n"
                f"- Skipped because abstract was missing/short: {skipped_no_abstract}\n"
                f"- Skipped by relevance score: {skipped_score}\n"
                f"- Skipped because OpenAI returned no article: {skipped_openai}\n"
                f"- Skipped by article quality gate: {skipped_quality}\n"
            )
            if LLM_ERRORS:
                summary_file.write("\n### LLM error samples\n\n")
                for error in LLM_ERRORS[:3]:
                    summary_file.write(f"- `{error[:500]}`\n")
    if skipped_openai > 0 and reported_created == 0:
        print(
            "LLM generation failed for every eligible candidate. "
            "Failing the workflow so the error is visible."
        )
        return 1
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit-per-feed", type=int, default=5)
    parser.add_argument("--max-created", type=int, default=None)
    parser.add_argument("--min-score", type=int, default=6)
    parser.add_argument("--min-abstract-chars", type=int, default=450)
    parser.add_argument("--status", choices=("draft", "published"), default="published")
    parser.add_argument("--draft", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--require-openai", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.25)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
