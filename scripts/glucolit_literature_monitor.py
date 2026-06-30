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

THUMBNAILS = [
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?q=80&w=1800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=1800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1800&auto=format&fit=crop",
]

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

BROAD_SOURCES = [
    (
        "PubMed prediabetes diet intervention",
        (
            '(prediabetes OR "impaired glucose tolerance" OR "insulin resistance") '
            'AND (diet OR nutrition OR meal OR breakfast OR fiber OR protein OR '
            '"Mediterranean diet" OR "glycemic index" OR "eating order")'
        ),
    ),
    (
        "PubMed prediabetes exercise intervention",
        (
            '(prediabetes OR "impaired glucose tolerance" OR "insulin resistance") '
            'AND (exercise OR "physical activity" OR walking OR aerobic OR '
            '"resistance training" OR "strength training" OR sedentary)'
        ),
    ),
    (
        "PubMed prediabetes sleep intervention",
        (
            '(prediabetes OR "impaired glucose tolerance" OR "insulin resistance") '
            'AND (sleep OR insomnia OR "sleep duration" OR "sleep quality" OR '
            '"sleep apnea" OR circadian OR chronotype)'
        ),
    ),
    (
        "PubMed prediabetes lifestyle intervention",
        (
            '(prediabetes OR "prediabetic state" OR "impaired fasting glucose" OR '
            '"impaired glucose tolerance") AND ("lifestyle intervention" OR '
            '"lifestyle modification" OR "diabetes prevention" OR diet OR exercise OR '
            '"physical activity" OR "weight loss" OR "insulin resistance")'
        ),
    ),
    (
        "PubMed diabetes prevention and remission",
        (
            '("type 2 diabetes" OR "diabetes prevention" OR prediabetes OR '
            '"prediabetic state") AND (prevention OR remission OR reversal OR '
            '"risk reduction" OR "weight loss" OR "intensive lifestyle")'
        ),
    ),
    (
        "PubMed insulin resistance interventions",
        (
            '("insulin resistance" OR "insulin sensitivity" OR HOMA-IR OR '
            '"metabolic syndrome") AND (diet OR nutrition OR exercise OR '
            '"physical activity" OR sleep OR "time-restricted eating" OR '
            '"intermittent fasting" OR "weight loss")'
        ),
    ),
    (
        "PubMed obesity and metabolic health",
        (
            '(obesity OR overweight OR adiposity OR "waist circumference") AND '
            '("type 2 diabetes" OR prediabetes OR "insulin resistance" OR '
            '"metabolic syndrome") AND (lifestyle OR diet OR exercise OR '
            '"weight management")'
        ),
    ),
    (
        "PubMed nutrition and glycemic control",
        (
            '(diet OR nutrition OR "Mediterranean diet" OR "low carbohydrate" OR '
            'fiber OR protein OR "ultra-processed food") AND '
            '(prediabetes OR "type 2 diabetes" OR "insulin resistance" OR HbA1c '
            'OR "glycemic control")'
        ),
    ),
    (
        "PubMed digital diabetes prevention",
        (
            '("diabetes prevention program" OR "digital health" OR app OR '
            'telehealth OR coaching OR "behavior change") AND '
            '(prediabetes OR "type 2 diabetes" OR "insulin resistance")'
        ),
    ),
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

CORE_TOPIC_TERMS = (
    "prediabetes",
    "pre-diabetes",
    "prediabetic",
    "impaired fasting glucose",
    "impaired glucose tolerance",
    "insulin resistance",
    "insulin sensitivity",
    "homa-ir",
    "diabetes prevention",
    "type 2 diabetes",
    "metabolic syndrome",
    "hba1c",
)

ACTION_OR_PREVENTION_TERMS = (
    "lifestyle",
    "intervention",
    "prevention",
    "diet",
    "nutrition",
    "exercise",
    "physical activity",
    "weight loss",
    "risk",
    "program",
    "coaching",
    "metabolic",
)

PRIORITY_TOPIC_TERMS = (
    "prediabetes",
    "pre-diabetes",
    "prediabetic",
    "impaired fasting glucose",
    "impaired glucose tolerance",
    "diabetes prevention",
    "national diabetes prevention program",
)

EDITORIAL_FOCUS_TERMS = {
    "diet": (
        "diet",
        "nutrition",
        "meal",
        "breakfast",
        "food",
        "fiber",
        "protein",
        "carbohydrate",
        "glycemic index",
        "mediterranean diet",
        "eating order",
    ),
    "sleep": (
        "sleep",
        "insomnia",
        "sleep duration",
        "sleep quality",
        "sleep apnea",
        "circadian",
        "chronotype",
    ),
    "exercise": (
        "exercise",
        "physical activity",
        "walking",
        "aerobic",
        "resistance training",
        "strength training",
        "sedentary",
        "muscle",
    ),
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
        "evidence_card": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "question": {"type": "string"},
                "population": {"type": "string"},
                "intervention_or_exposure": {"type": "string"},
                "comparison": {"type": "string"},
                "outcomes": {"type": "string"},
                "main_findings": {"type": "string"},
                "limits": {"type": "string"},
                "reader_meaning": {"type": "string"},
            },
            "required": [
                "question",
                "population",
                "intervention_or_exposure",
                "comparison",
                "outcomes",
                "main_findings",
                "limits",
                "reader_meaning",
            ],
        },
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
        "evidence_card",
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
    authors: str = ""
    pmid: str = ""
    pmcid: str = ""
    doi: str = ""
    oa_url: str = ""
    evidence: str = "PubMed abstract"
    full_text_excerpt: str = ""


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


def clamp_future_date(value: str) -> str:
    today = dt.date.today()
    try:
        parsed = dt.date.fromisoformat((value or "")[:10])
    except ValueError:
        return today.isoformat()
    return min(parsed, today).isoformat()


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
    return clamp_future_date(
        f"{year or dt.date.today().year}-{int(month_number):02d}-{int(day):02d}"
    )


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


def article_pmcid(article: ET.Element) -> str:
    for node in article.findall(".//ArticleId"):
        if node.attrib.get("IdType", "").lower() == "pmc" and node.text:
            return node.text.strip()
    return ""


def article_authors(article: ET.Element) -> str:
    authors: list[str] = []
    for node in article.findall(".//Author"):
        last = strip_html(node.findtext("LastName", default=""))
        initials = strip_html(node.findtext("Initials", default=""))
        collective = strip_html(node.findtext("CollectiveName", default=""))
        if collective:
            authors.append(collective)
        elif last:
            authors.append(f"{last} {initials}".strip())
        if len(authors) >= 6:
            break
    if not authors:
        return ""
    suffix = " et al." if len(article.findall(".//Author")) > len(authors) else ""
    return ", ".join(authors) + suffix


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
        pmcid = article_pmcid(article)
        authors = article_authors(article)
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
                    authors=authors,
                    pmid=pmid,
                    pmcid=pmcid,
                    doi=doi,
                )
            )
    return papers


def search_pubmed_term(source: str, term: str, limit: int) -> list[PaperItem]:
    search_url = pubmed_url(
        "esearch.fcgi",
        {
            "db": "pubmed",
            "retmode": "json",
            "retmax": str(limit),
            "sort": "pub date",
            "term": term,
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


def search_pubmed(source: str, journal_query: str, limit: int) -> list[PaperItem]:
    return search_pubmed_term(source, f"({journal_query}) AND {TOPIC_QUERY}", limit)


def pmc_text_from_xml(xml_text: str, max_chars: int = 9000) -> str:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return ""

    preferred_sections = {
        "abstract",
        "intro",
        "introduction",
        "background",
        "methods",
        "materials|methods",
        "results",
        "discussion",
        "conclusion",
        "conclusions",
    }
    skip_sections = {"ref-list", "ack", "funding-group", "app-group", "supplementary-material"}
    chunks: list[str] = []

    for section in root.findall(".//sec"):
        sec_type = section.attrib.get("sec-type", "").lower()
        if sec_type in skip_sections:
            continue
        title = strip_html(" ".join(section.findtext("title", default="").split()))
        title_key = title.lower()
        if (
            sec_type
            and sec_type not in preferred_sections
            and not any(key in title_key for key in preferred_sections)
        ):
            continue
        paragraphs = [
            strip_html("".join(paragraph.itertext()))
            for paragraph in section.findall(".//p")
        ]
        body = "\n\n".join(paragraph for paragraph in paragraphs if len(paragraph) > 80)
        if body:
            heading = title or sec_type.title()
            chunks.append(f"{heading}\n{body}")
        if sum(len(chunk) for chunk in chunks) >= max_chars:
            break

    if not chunks:
        paragraphs = [
            strip_html("".join(paragraph.itertext()))
            for paragraph in root.findall(".//body//p")
        ]
        chunks = [paragraph for paragraph in paragraphs if len(paragraph) > 100]

    text = "\n\n".join(chunks)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:max_chars]


def pubmed_linked_pmcid(pmid: str) -> str:
    if not pmid:
        return ""
    url = pubmed_url(
        "elink.fcgi",
        {
            "dbfrom": "pubmed",
            "db": "pmc",
            "retmode": "json",
            "id": pmid,
        },
    )
    try:
        data = json.loads(fetch_text(url, timeout=8))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return ""
    linksets = data.get("linksets", [])
    for linkset in linksets:
        for linksetdb in linkset.get("linksetdbs", []):
            for link in linksetdb.get("links", []):
                link = str(link).strip()
                if link:
                    return f"PMC{link}" if not link.upper().startswith("PMC") else link
    return ""


def pmc_full_text_excerpt(pmcid: str) -> str:
    if not pmcid:
        return ""
    clean_pmcid = pmcid.upper().replace("PMC", "")
    url = pubmed_url(
        "efetch.fcgi",
        {"db": "pmc", "retmode": "xml", "id": clean_pmcid},
    )
    try:
        return pmc_text_from_xml(fetch_text(url, timeout=12, accept="text/xml,*/*"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return ""


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
    if not paper.pmcid and metadata.get("pmcid"):
        paper.pmcid = str(metadata["pmcid"]).strip()
    if not paper.pmcid:
        paper.pmcid = pubmed_linked_pmcid(paper.pmid)
    if paper.pmcid and not paper.full_text_excerpt:
        paper.full_text_excerpt = pmc_full_text_excerpt(paper.pmcid)
        if paper.full_text_excerpt:
            paper.evidence += " + PubMed Central open full-text excerpt"
    paper.oa_url = best_europe_pmc_url(metadata) or unpaywall_oa_url(paper.doi)
    if not paper.oa_url and paper.pmcid:
        paper.oa_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{paper.pmcid}/"
    if paper.oa_url:
        paper.evidence += " + open-access full-text link"
    return paper


def evidence_text(paper: PaperItem) -> str:
    parts = []
    if paper.summary:
        parts.append(f"Abstract:\n{paper.summary}")
    if paper.full_text_excerpt:
        parts.append(f"PubMed Central open full-text excerpt:\n{paper.full_text_excerpt}")
    return "\n\n".join(parts)


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


def is_direct_glucolit_topic(title: str, evidence: str) -> bool:
    text = f"{title} {evidence}".lower()
    has_core = any(term in text for term in CORE_TOPIC_TERMS)
    has_action = any(term in text for term in ACTION_OR_PREVENTION_TERMS)
    return has_core and has_action


def priority_topic_score(paper: PaperItem) -> int:
    title_and_abstract = f"{paper.title} {paper.summary}".lower()
    evidence = evidence_text(paper).lower()
    score = sum(4 for term in PRIORITY_TOPIC_TERMS if term in title_and_abstract)
    score += sum(1 for term in PRIORITY_TOPIC_TERMS if term in evidence)
    if paper.full_text_excerpt:
        score += 2
    return score


def editorial_focus(paper: PaperItem) -> str:
    title = paper.title.lower()
    evidence = evidence_text(paper).lower()
    scores = {
        focus: sum(5 for term in terms if term in title)
        + sum(1 for term in terms if term in evidence)
        for focus, terms in EDITORIAL_FOCUS_TERMS.items()
    }
    focus, score = max(scores.items(), key=lambda item: item[1])
    return focus if score > 0 else "general"


def destination_topic(paper: PaperItem) -> str:
    return "diet" if editorial_focus(paper) == "diet" else (
        "exercise-sleep"
        if editorial_focus(paper) in {"sleep", "exercise"}
        else "prediabetes"
    )


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


def yaml_string_list(values: list[str]) -> str:
    return "[" + ", ".join(json.dumps(value, ensure_ascii=False) for value in values) + "]"


def thumbnail_for_paper(paper: PaperItem) -> str:
    seed = paper.doi or paper.pmid or paper.title
    index = int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8], 16)
    return THUMBNAILS[index % len(THUMBNAILS)]


def build_prompt(paper: PaperItem, matched: list[str]) -> str:
    focus = editorial_focus(paper)
    return textwrap.dedent(
        f"""
        You are the GLUCOLIT medical research editor.

        Editorial focus for this draft: {focus}. Keep the article centered on
        this focus. For diet, translate evidence into realistic meal structure,
        food swaps, portions, and eating scenarios. For exercise, explain
        frequency, intensity, progression, safety, and adherence without
        inventing a prescription. For sleep, explain schedule, duration,
        quality, sleep-disorder signals, and practical sleep routines. Do not
        dilute the article into a generic prediabetes overview.

        Follow the GLUCOLIT two-step editorial SOP:
        1. First extract an evidence card from the source.
        2. Then write a publishable intervention-guide style draft for readers
           with prediabetes, insulin resistance, or early metabolic risk. The
           article is a third-party commentary, not a translated abstract and
           not a metadata list.
        3. Then write a faithful English plain-language version with the same
           meaning.
        4. Explain uncertainty and limits. Do not turn association into
           causation. Do not give personal medical advice.

        Use only the title, abstract, source metadata, DOI/link, and the
        PubMed Central open full-text excerpt if provided. Do not invent sample
        size, methods, results, harms, or causal claims that are not in the
        evidence. If the source is only an abstract or metadata, make the
        article an abstract-based commentary. If a PubMed Central excerpt is
        available, you may use it for richer context, but still avoid copying
        or closely paraphrasing long passages. Mention facts in your own words
        and keep the reader pointed to PubMed/DOI/source links for the complete
        original.

        Required style:
        - Chinese plain_zh: at least 2400 Chinese characters, warm, clear,
          practical, written like an experienced health editor and original
          analyst.
        - English plain_en: at least 700 English characters, faithful to the
          Chinese version.
        - Use short paragraphs. Chinese paragraphs should usually be 2-4
          sentences and about 90-150 Chinese characters. English paragraphs
          should usually be 2-4 sentences and about 120-180 words.
        - Each paragraph should explain one idea only. If the topic changes,
          start a new paragraph.
        - No empty paragraphs, no empty bullets, no screening-note language.
        - Do not put source metadata such as Original title, Authors, DOI,
          PubMed link, or Journal/source inside plain_zh or plain_en. Those
          belong only in the Research Primer.
        - Define technical terms briefly when needed.
        - Make the result useful without making it sound like medical advice.
        - Avoid reviewer voice. Do not repeatedly write phrases like
          "this study", "this paper", "the researchers", "这篇研究",
          "这项研究", "这篇报告", or "研究者发现". Start from the reader's
          problem and the source topic, not from manuscript-review narration.

        Invisible article architecture for plain_zh. This is a writing plan,
        not public copy. Do NOT print these steps as labels:
        - Open with a concrete reader scene and a useful takeaway in the first
          two paragraphs.
        - Explain why the topic matters with a daily-life analogy.
        - Translate the source evidence: question, population,
          intervention/exposure, comparison, outcomes, and strongest
          source-bounded finding. Use numbers only when the source provides
          them.
        - Explain mechanism in plain language, then explain uncertainty and
          limits: association vs causation, sample applicability, missing data,
          and what readers should not overclaim.
        - Convert evidence into cautious, practical actions a reader can
          discuss with a clinician. Do not give personal medical advice.
        - Add original GLUCOLIT insight for behavior design, care workflow,
          product/data opportunities, or patient education when relevant.
        - End with 3-5 memorable takeaways in natural language.
        Do not print internal workflow labels, editor notes, checklist labels,
        or review-template language in plain_zh or plain_en.
        Never use visible Markdown heading markers inside
        plain_zh or plain_en.

        Return strict JSON with:
        title_en, title_zh, description_en, description_zh,
        plain_en, plain_zh, takeaways_en, takeaways_zh,
        why_relevant_en, why_relevant_zh, evidence_card.

        evidence_card must contain:
        question, population, intervention_or_exposure, comparison, outcomes,
        main_findings, limits, reader_meaning.

        takeaways_en and takeaways_zh must each contain at least 4 useful,
        non-empty items.

        Source: {paper.source}
        Title: {paper.title}
        PMID: {paper.pmid}
        PMCID: {paper.pmcid}
        DOI: {paper.doi}
        Link: {paper.link}
        Authors: {paper.authors}
        Open-access link if available: {paper.oa_url}
        Evidence type: {paper.evidence}
        Published date: {paper.published_at}
        Matched relevance keywords: {", ".join(matched)}

        Evidence:
        {evidence_text(paper)[:9000]}
        """
    ).strip()


def build_revision_prompt(
    paper: PaperItem,
    matched: list[str],
    article: dict[str, Any],
    quality_issues: list[str],
) -> str:
    return textwrap.dedent(
        f"""
        You are the GLUCOLIT senior medical editor. Revise the draft below so
        it follows the GLUCOLIT Research Rewrite SOP and fixes these quality
        issues:

        {json.dumps(quality_issues, ensure_ascii=False, indent=2)}

        Non-negotiable revision rules:
        - Keep every claim source-bounded. Use only the provided title,
          abstract, DOI/link, and metadata.
        - Do not invent full-text details, sample sizes, methods, or outcomes
          that are not in the evidence.
        - Do not write in reviewer voice. Avoid repeated phrases like
          "this study", "this paper", "the researchers", "这篇研究",
          "这项研究", or "这篇报告".
        - Chinese paragraphs must be short and readable. One paragraph should
          usually contain 2-4 sentences and stay under about 150 Chinese
          characters. Break long blocks aggressively.
        - Use an invisible article architecture, not visible template labels:
          reader scene, evidence story, mechanism explanation, uncertainty and
          limits, cautious actions, original GLUCOLIT insight, and memorable
          closing takeaways.
        - Never print internal workflow labels, editor notes, checklist labels,
          or review-template language in the public article body.
        - Never use visible Markdown heading markers in
          plain_zh or plain_en.
        - The evidence story should be compact and source-bounded. The
          interpretation and action parts should be the main original
          commentary, not a rewritten abstract.
        - Remove empty bullets and any human-review warning from the article
          body.
        - Return strict JSON with the same schema as the draft.

        Source metadata:
        Source: {paper.source}
        Title: {paper.title}
        PMID: {paper.pmid}
        PMCID: {paper.pmcid}
        DOI: {paper.doi}
        Link: {paper.link}
        Authors: {paper.authors}
        Open-access link if available: {paper.oa_url}
        Evidence type: {paper.evidence}
        Published date: {paper.published_at}
        Matched relevance keywords: {", ".join(matched)}

        Evidence:
        {evidence_text(paper)[:9000]}

        Draft JSON to revise:
        {json.dumps(article, ensure_ascii=False)}
        """
    ).strip()


def llm_config() -> LLMConfig | None:
    kimi_key = os.getenv("KIMI_API_KEY")
    if kimi_key:
        return LLMConfig(
            provider="Kimi",
            api_key=kimi_key,
            base_url=os.getenv("KIMI_BASE_URL", "https://api.moonshot.ai/v1").rstrip("/"),
            model=os.getenv("KIMI_MODEL", "moonshot-v1-8k"),
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
        "max_tokens": 7600,
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
        with urllib.request.urlopen(request, timeout=45) as response:
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
        "max_output_tokens": 7600,
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
        with urllib.request.urlopen(request, timeout=45) as response:
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


def revise_article_with_sop(
    paper: PaperItem,
    matched: list[str],
    article: dict[str, Any],
    quality_issues: list[str],
) -> dict[str, Any] | None:
    prompt = build_revision_prompt(paper, matched, article, quality_issues)
    return generate_article(prompt)


def count_cjk(value: str) -> int:
    return sum(1 for char in value if "\u4e00" <= char <= "\u9fff")


def has_mojibake(value: str) -> bool:
    markers = [
        "\ufffd",
        "\u00c3",
        "\u00c2",
        "\u935a",
        "\u9286",
        "\u940e",
        "\u7d8b",
        "\u20ac",
    ]
    return sum(value.count(marker) for marker in markers) >= 2


def has_empty_markdown_bullets(value: str) -> bool:
    return bool(re.search(r"(?m)^\s*[-*]\s*$", value))


FORBIDDEN_PUBLIC_PHRASES = [
    "\u5148\u8bf4\u7ed3\u8bba",
    "\u4e3a\u4ec0\u4e48\u503c\u5f97\u5173\u6ce8",
    "\u8bc1\u636e\u544a\u8bc9\u6211\u4eec\u4ec0\u4e48",
    "\u5e94\u8be5\u600e\u6837\u7406\u89e3",
    "\u53ef\u4ee5\u600e\u4e48\u505a",
    "\u7ed9\u7cd6\u524d\u8bfb\u8005",
    "\u7ed9\u5065\u5eb7\u79d1\u6280\u884c\u4e1a",
    "\u4f60\u7684\u6279\u5224\u4e0e\u89e3\u8bfb",
    "\u4f60\u7684\u89e3\u8bfb\u4e0e\u6279\u5224",
    "\u4e34\u5e8a/\u5546\u4e1a\u542f\u53d1",
]

REVIEWER_VOICE_PHRASES = [
    "This study",
    "The study",
    "this paper",
    "the researchers",
    "researchers found",
    "这篇研究",
    "这项研究",
    "这篇报告",
    "这篇论文",
    "研究者发现",
]

def count_readable_paragraphs(value: str) -> int:
    paragraphs = [
        part.strip()
        for part in re.split(r"\n{2,}", value.replace("\r\n", "\n").replace("\r", "\n"))
        if part.strip()
    ]
    return sum(1 for paragraph in paragraphs if count_cjk(paragraph) >= 35)


def has_evidence_signals(value: str) -> bool:
    signals = ["人群", "样本", "研究", "结果", "风险", "数据", "观察", "分析", "发现"]
    return sum(1 for signal in signals if signal in value) >= 3


def has_boundary_signals(value: str) -> bool:
    signals = ["不能证明", "相关", "因果", "局限", "不代表", "仍需要", "适用", "可能"]
    return sum(1 for signal in signals if signal in value) >= 2


def has_action_signals(value: str) -> bool:
    signals = ["可以", "建议", "优先", "记录", "复查", "咨询", "运动", "饮食", "睡眠", "体重"]
    return sum(1 for signal in signals if signal in value) >= 3


def has_original_insight(value: str) -> bool:
    signals = ["干预", "依从", "行为", "工具", "监测", "产品", "流程", "管理", "数据", "反馈"]
    return sum(1 for signal in signals if signal in value) >= 3


def reviewer_voice_count(text: str) -> int:
    lower = text.lower()
    total = 0
    for phrase in REVIEWER_VOICE_PHRASES:
        total += lower.count(phrase.lower())
    return total


def markdown_value_to_text(value: Any) -> str:
    if isinstance(value, dict):
        parts: list[str] = []
        for key, item in value.items():
            heading = str(key).strip()
            body = markdown_value_to_text(item).strip()
            if heading:
                parts.append(heading)
            if body:
                parts.append(body)
        return "\n\n".join(parts)
    if isinstance(value, list):
        return "\n\n".join(
            markdown_value_to_text(item).strip()
            for item in value
            if markdown_value_to_text(item).strip()
        )
    return str(value or "")


def clean_markdown_text(value: Any) -> str:
    text = markdown_value_to_text(value).replace("\r\n", "\n").replace("\r", "\n").strip()
    lines: list[str] = []
    blank_seen = False
    for raw_line in text.split("\n"):
        line = raw_line.rstrip()
        if re.match(r"^\s*[-*]\s*$", line):
            continue
        if not line.strip():
            if not blank_seen:
                lines.append("")
            blank_seen = True
            continue
        lines.append(line)
        blank_seen = False
    return "\n".join(lines).strip()


def article_quality_issues(article: dict[str, Any] | None) -> list[str]:
    issues: list[str] = []
    if not article:
        return ["LLM returned no article object"]
    required = [
        "title_en",
        "title_zh",
        "description_en",
        "description_zh",
        "plain_en",
        "plain_zh",
        "why_relevant_en",
        "why_relevant_zh",
        "evidence_card",
    ]
    missing = [key for key in required if not article.get(key)]
    if missing:
        issues.append(f"missing fields: {', '.join(missing)}")
    plain_en = clean_markdown_text(article.get("plain_en", ""))
    plain_zh = clean_markdown_text(article.get("plain_zh", ""))
    plain_text = f"{plain_en}\n{plain_zh}"
    blocked = [
        "This item appears relevant",
        "automated screening result",
        "Matched keywords",
        "system selected",
        "Human review note",
        "这篇报告",
        "\u6a21\u578b\u8f93\u51fa\u6ca1\u6709\u5b8c\u5168\u901a\u8fc7\u8d28\u91cf\u68c0\u67e5",
        "\u88ab\u7cfb\u7edf\u9009\u4e2d",
        "\u547d\u4e2d\u5173\u952e\u8bcd",
    ]
    if any(phrase in plain_text for phrase in blocked):
        issues.append("contains blocked screening-note language")
    if has_mojibake(plain_text):
        issues.append("contains broken encoding text")
    if has_empty_markdown_bullets(plain_text):
        issues.append("contains empty markdown bullets")
    if len(plain_en) < 700:
        issues.append("English plain-language article is short")
    if count_cjk(plain_zh) < 2200:
        issues.append("Chinese commentary is short for the required SOP structure")
    if count_readable_paragraphs(plain_zh) < 10:
        issues.append("Chinese article needs more short readable paragraphs")
    leaked_labels = [
        phrase for phrase in FORBIDDEN_PUBLIC_PHRASES if phrase in plain_text
    ]
    if leaked_labels:
        issues.append(f"contains public-facing template labels: {', '.join(leaked_labels)}")
    if re.search(r"(?m)^\s*#{1,6}\s+", plain_text):
        issues.append("contains visible Markdown heading markers")
    if not has_evidence_signals(plain_zh):
        issues.append("Chinese evidence story is too thin")
    if not has_boundary_signals(plain_zh):
        issues.append("Chinese interpretation and critique section is short")
    if not has_action_signals(plain_zh):
        issues.append("Chinese practical action guidance is too thin")
    if not has_original_insight(plain_zh):
        issues.append("Chinese clinical/business insight section is short")
    if reviewer_voice_count(plain_text) > 4:
        issues.append("uses reviewer voice too often")
    if plain_zh.lstrip().startswith(("这篇研究", "这项研究", "这篇报告", "这篇论文")):
        issues.append("starts with reviewer voice")
    if len(normalize_takeaways(article.get("takeaways_en", []))) < 4:
        issues.append("English takeaways are incomplete")
    if len(normalize_takeaways(article.get("takeaways_zh", []))) < 4:
        issues.append("Chinese takeaways are incomplete")
    card = article.get("evidence_card")
    if not isinstance(card, dict):
        issues.append("evidence card is missing")
    else:
        card_fields = [
            "question",
            "population",
            "intervention_or_exposure",
            "comparison",
            "outcomes",
            "main_findings",
            "limits",
            "reader_meaning",
        ]
        empty_card_fields = [
            field for field in card_fields if not str(card.get(field, "")).strip()
        ]
        if empty_card_fields:
            issues.append(f"evidence card missing fields: {', '.join(empty_card_fields)}")
    return issues


def is_valid_article(article: dict[str, Any] | None) -> bool:
    return not article_quality_issues(article)


def normalize_article(article: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(article)
    for key in [
        "title_en",
        "title_zh",
        "description_en",
        "description_zh",
        "plain_en",
        "plain_zh",
        "why_relevant_en",
        "why_relevant_zh",
    ]:
        normalized[key] = clean_markdown_text(normalized.get(key, ""))
    normalized["takeaways_en"] = normalize_takeaways(normalized.get("takeaways_en", []))
    normalized["takeaways_zh"] = normalize_takeaways(normalized.get("takeaways_zh", []))
    if isinstance(normalized.get("evidence_card"), dict):
        normalized["evidence_card"] = {
            key: clean_markdown_text(value)
            for key, value in normalized["evidence_card"].items()
        }
    return normalized


def normalize_takeaways(items: Any) -> list[str]:
    if isinstance(items, list):
        return [str(item).strip() for item in items if str(item).strip()]
    if isinstance(items, str):
        lines = [
            line.strip(" -•\t")
            for line in re.split(r"[\r\n]+", items)
            if line.strip(" -•\t")
        ]
        if len(lines) > 1:
            return lines
        sentences = [
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?。！？])\s+", items.strip())
            if sentence.strip()
        ]
        return sentences or ([items.strip()] if items.strip() else [])
    return []


def bullet_list(items: Any) -> str:
    return "\n".join(f"- {item}" for item in normalize_takeaways(items))


def sentence_chunks(text: str) -> list[str]:
    parts = re.findall(r"[^。！？.!?；;]+[。！？.!?；;]?", text)
    return [part.strip() for part in parts if part.strip()] or [text.strip()]


def split_long_sentence(sentence: str, max_chars: int) -> list[str]:
    if len(sentence) <= max_chars:
        return [sentence]
    chunks: list[str] = []
    remaining = sentence.strip()
    while len(remaining) > max_chars:
        window = remaining[:max_chars]
        break_at = max(
            window.rfind("，"),
            window.rfind(","),
            window.rfind("、"),
            window.rfind(" "),
        )
        cut = break_at + 1 if break_at > max_chars * 0.45 else max_chars
        chunks.append(remaining[:cut].strip())
        remaining = remaining[cut:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks


def format_plain_article(text: str, *, language: str) -> str:
    max_chars = 145 if language == "zh" else 240
    normalized = clean_markdown_text(text)
    normalized = re.sub(r"([。！？.!?；;])\s+[-*]\s+", r"\1\n- ", normalized)
    blocks = [block.strip() for block in re.split(r"\n{2,}", normalized) if block.strip()]
    paragraphs: list[str] = []

    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if lines and all(re.match(r"^[-*]\s+", line) for line in lines):
            paragraphs.append("\n".join(lines))
            continue

        current = ""
        for sentence in sentence_chunks(re.sub(r"\s+", " ", block)):
            for part in split_long_sentence(sentence, max_chars):
                candidate = f"{current} {part}".strip() if current else part
                if current and len(candidate) > max_chars:
                    paragraphs.append(current)
                    current = part
                else:
                    current = candidate
        if current:
            paragraphs.append(current)

    return "\n\n".join(paragraphs)


def evidence_card_markdown(card: dict[str, Any]) -> str:
    rows = [
        ("研究问题 / Research question", "question"),
        ("研究对象 / Population", "population"),
        ("干预或暴露 / Intervention or exposure", "intervention_or_exposure"),
        ("对照 / Comparison", "comparison"),
        ("观察指标 / Outcomes", "outcomes"),
        ("主要发现 / Main findings", "main_findings"),
        ("局限性 / Limits", "limits"),
        ("读者怎么理解 / Reader meaning", "reader_meaning"),
    ]
    return "\n".join(
        f"- **{label}:** {clean_markdown_text(card.get(key, ''))}"
        for label, key in rows
        if clean_markdown_text(card.get(key, ""))
    )


def article_to_mdx(
    paper: PaperItem,
    article: dict[str, Any],
    status: str,
    draft: bool,
    quality_issues: list[str] | None = None,
) -> str:
    article = normalize_article(article)
    published_at = clamp_future_date(paper.published_at)
    title = f"{article['title_zh']} / {article['title_en']}"
    description = f"{article['description_zh']} {article['description_en']}"
    doi_line = f"- DOI: [{paper.doi}](https://doi.org/{paper.doi})\n" if paper.doi else ""
    pmcid_line = (
        f"- PubMed Central: [{paper.pmcid}](https://pmc.ncbi.nlm.nih.gov/articles/{paper.pmcid}/)\n"
        if paper.pmcid
        else ""
    )
    oa_line = f"- Open-access link: [{paper.oa_url}]({paper.oa_url})\n" if paper.oa_url else ""
    authors_line = f"- Authors: {paper.authors}\n" if paper.authors else ""
    quality_issues = quality_issues or []
    quality_status = "needs_revision" if quality_issues else "ready"
    frontmatter = [
        "---",
        f'title: "{md_escape(title[:180])}"',
        f'description: "{md_escape(description[:260])}"',
        f"publishedAt: {published_at}",
        f'tags: {yaml_list(["medical-research", "prediabetes", "lifestyle"])}',
        f"thumbnail: {thumbnail_for_paper(paper)}",
        f"status: {status}",
        f"draft: {str(draft).lower()}",
        f"reviewRequired: {str(bool(quality_issues)).lower()}",
        f"qualityStatus: {quality_status}",
        f"topic: {destination_topic(paper)}",
    ]
    if quality_issues:
        frontmatter.append(f"qualityIssues: {yaml_string_list(quality_issues)}")
    frontmatter.append("---")
    return "\n".join(
        frontmatter
        + [
            "",
            *(
                [
                    "> **待修订提醒：** 这篇草稿已进入后台，但还没有完全通过 GLUCOLIT 发布质量门。请按下方 SOP 检查并人工改稿后再发布。",
                    "",
                    "待修订问题",
                    "",
                    bullet_list(quality_issues),
                    "",
                ]
                if quality_issues
                else []
            ),
            "> 本站文章基于公开学术文献进行第三方评论，不代表原文作者及出版机构立场。本文仅供科普参考，不构成医疗建议。如有健康问题，请咨询专业医生。",
            "",
            "## 审核用证据卡片",
            "",
            evidence_card_markdown(article.get("evidence_card", {})),
            "",
            "## 原文精华摘要",
            "",
            format_plain_article(article["plain_zh"], language="zh"),
            "",
            "为什么和糖尿病前期有关？",
            "",
            format_plain_article(article["why_relevant_zh"], language="zh"),
            "",
            "你可以带走的重点",
            "",
            bullet_list(article.get("takeaways_zh", [])),
            "",
            "## English Plain-Language Version",
            "",
            format_plain_article(article["plain_en"], language="en"),
            "",
            "Why This Matters for Prediabetes",
            "",
            format_plain_article(article["why_relevant_en"], language="en"),
            "",
            "Practical Takeaways",
            "",
            bullet_list(article.get("takeaways_en", [])),
            "",
            "## Research Primer / 参考文献",
            "",
            f"- Journal/source: {paper.source}",
            f"- Evidence used: {paper.evidence}",
            f"- Original title: {paper.title}",
            authors_line.rstrip(),
            f"- PubMed: [{paper.link}]({paper.link})",
            doi_line.rstrip(),
            pmcid_line.rstrip(),
            oa_line.rstrip(),
            f"- Published or indexed date: {published_at}",
            "",
            "如需阅读原文，请点击链接获取完整内容。",
            "",
            "本站文章基于公开学术文献进行第三方评论，不代表原文作者及出版机构立场。如涉版权问题，请权利人联系下架。",
            "",
        ]
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


def write_article(
    paper: PaperItem,
    item_id: str,
    article: dict[str, Any],
    status: str,
    draft: bool,
    quality_issues: list[str] | None = None,
) -> Path:
    slug = slugify(paper.title, item_id)
    post_dir = CONTENT_ROOT / slug
    post_dir.mkdir(parents=True, exist_ok=True)
    post_path = post_dir / "en.mdx"
    post_path.write_text(
        article_to_mdx(paper, article, status, draft, quality_issues),
        encoding="utf-8",
    )
    return post_path


def candidate_papers(limit_per_journal: int, max_candidates: int) -> list[PaperItem]:
    papers: list[PaperItem] = []
    seen: set[str] = set()
    broad_limit = max(limit_per_journal * 8, 12)
    for source, query in BROAD_SOURCES:
        print(f"Searching PubMed: {source}")
        try:
            source_papers = search_pubmed_term(source, query, broad_limit)
        except Exception as exc:  # noqa: BLE001
            print(f"PubMed search failed for {source}: {exc}")
            source_papers = []
        for paper in source_papers:
            item_id = stable_id(paper.link, paper.title)
            if item_id in seen:
                continue
            seen.add(item_id)
            papers.append(paper)
            time.sleep(0.1)

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
    preselected = sorted(
        papers,
        key=lambda paper: (
            relevance_score(paper.title, paper.summary)[0],
            len(paper.summary),
            paper.published_at,
        ),
        reverse=True,
    )[:max_candidates]

    enriched: list[PaperItem] = []
    for paper in preselected:
        try:
            enriched.append(enrich_paper(paper))
            time.sleep(0.1)
        except Exception as exc:  # noqa: BLE001
            print(f"Open-access enrichment failed for {paper.title}: {exc}")
            enriched.append(paper)

    ranked = sorted(
        enriched,
        key=lambda paper: (
            priority_topic_score(paper),
            bool(paper.full_text_excerpt),
            bool(paper.oa_url),
            relevance_score(paper.title, evidence_text(paper))[0],
            len(evidence_text(paper)),
            paper.published_at,
        ),
        reverse=True,
    )
    buckets = {
        focus: [paper for paper in ranked if editorial_focus(paper) == focus]
        for focus in ("diet", "sleep", "exercise")
    }
    other = [
        paper
        for paper in ranked
        if editorial_focus(paper) not in {"diet", "sleep", "exercise"}
    ]
    balanced: list[PaperItem] = []
    while any(buckets.values()):
        for focus in ("diet", "sleep", "exercise"):
            if buckets[focus]:
                balanced.append(buckets[focus].pop(0))
    return (balanced + other)[:max_candidates]


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
    saved_needs_revision = 0
    llm_attempts = 0

    for paper in candidate_papers(args.limit_per_feed, args.max_candidates):
        if args.max_created is not None and created_count >= args.max_created:
            print(f"Reached max-created={args.max_created}; stopping.")
            break

        scanned += 1
        item_id = stable_id(paper.link, paper.title)
        existing = state["items"].get(item_id)
        if existing and existing.get("generated"):
            continue

        usable_evidence = evidence_text(paper)
        score, matched = relevance_score(paper.title, usable_evidence)
        attempts = int(existing.get("attempts", 0)) if existing else 0
        state["items"][item_id] = {
            "title": paper.title,
            "source": paper.source,
            "link": paper.link,
            "pmid": paper.pmid,
            "pmcid": paper.pmcid,
            "doi": paper.doi,
            "oa_url": paper.oa_url,
            "evidence": paper.evidence,
            "full_text_excerpt_chars": len(paper.full_text_excerpt),
            "published_at": paper.published_at,
            "score": score,
            "matched": matched,
            "created_at": existing.get("created_at") if existing else dt.datetime.now(dt.UTC).isoformat(),
            "last_seen_at": dt.datetime.now(dt.UTC).isoformat(),
            "attempts": attempts,
            "generated": False,
        }

        if len(usable_evidence) < args.min_abstract_chars:
            print(f"Skip no usable evidence: {paper.title}")
            state["items"][item_id]["skip_reason"] = "missing or too-short abstract/full-text evidence"
            skipped_no_abstract += 1
            continue
        if not is_direct_glucolit_topic(paper.title, usable_evidence):
            print(f"Skip not direct GLUCOLIT topic: {paper.title}")
            state["items"][item_id]["skip_reason"] = "not directly about prediabetes prevention or insulin resistance"
            skipped_score += 1
            continue
        if score < args.min_score:
            print(f"Skip score={score}: {paper.title}")
            state["items"][item_id]["skip_reason"] = f"score {score} below min-score {args.min_score}"
            skipped_score += 1
            continue

        if not paper.oa_url:
            paper = enrich_paper(paper)
        state["items"][item_id]["doi"] = paper.doi
        state["items"][item_id]["pmcid"] = paper.pmcid
        state["items"][item_id]["oa_url"] = paper.oa_url
        state["items"][item_id]["evidence"] = paper.evidence
        state["items"][item_id]["full_text_excerpt_chars"] = len(paper.full_text_excerpt)
        state["items"][item_id]["attempts"] = attempts + 1
        if args.dry_run and not (os.getenv("OPENAI_API_KEY") or os.getenv("KIMI_API_KEY")):
            print(f"Would create score={score}: {paper.title}")
            created_count += 1
            continue

        if args.max_llm_attempts is not None and llm_attempts >= args.max_llm_attempts:
            print(f"Reached max-llm-attempts={args.max_llm_attempts}; stopping.")
            break

        llm_attempts += 1
        article = generate_article(build_prompt(paper, matched))
        if article is None:
            print(f"Skip because OpenAI did not return an article: {paper.title}")
            state["items"][item_id]["skip_reason"] = "OpenAI did not return an article"
            skipped_openai += 1
            continue
        article = normalize_article(article)
        quality_issues = article_quality_issues(article)
        if quality_issues:
            print(
                "Article failed GLUCOLIT quality gate; trying one SOP revision: "
                f"{paper.title} ({'; '.join(quality_issues)})"
            )
            revised = revise_article_with_sop(paper, matched, article, quality_issues)
            if revised is not None:
                revised = normalize_article(revised)
                revised_issues = article_quality_issues(revised)
                if len(revised_issues) <= len(quality_issues):
                    article = revised
                    quality_issues = revised_issues

            if quality_issues:
                print(
                    "Saving as needs-revision draft after quality gate: "
                    f"{paper.title} ({'; '.join(quality_issues)})"
                )
                skipped_quality += 1
                if args.dry_run:
                    print(f"Would create needs-revision draft score={score}: {paper.title}")
                    created_count += 1
                    continue

                path = write_article(
                    paper,
                    item_id,
                    article,
                    args.status,
                    args.draft,
                    quality_issues,
                )
                created.append(path)
                created_count += 1
                saved_needs_revision += 1
                state["items"][item_id]["generated"] = True
                state["items"][item_id]["path"] = str(path.relative_to(REPO_ROOT))
                state["items"][item_id]["quality_status"] = "needs_revision"
                state["items"][item_id]["quality_issues"] = quality_issues
                state["items"][item_id]["skip_reason"] = "saved as needs-revision draft"
                print(f"Created needs-revision draft {path.relative_to(REPO_ROOT)}")
                time.sleep(args.sleep)
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
        state["items"][item_id]["quality_status"] = "ready"
        state["items"][item_id].pop("skip_reason", None)
        state["items"][item_id].pop("quality_issues", None)
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
                "\n## Run result\n\n"
                f"- Scanned candidate papers: {scanned}\n"
                f"- Created draft articles: {reported_created}\n"
                f"- LLM generation attempts: {llm_attempts}\n"
                f"- Skipped because abstract was missing/short: {skipped_no_abstract}\n"
                f"- Skipped by relevance score: {skipped_score}\n"
                f"- Skipped because OpenAI returned no article: {skipped_openai}\n"
                f"- Saved as needs-revision drafts: {saved_needs_revision}\n"
                f"- Still carrying quality issues: {skipped_quality}\n"
            )
            if LLM_ERRORS:
                summary_file.write("\n## LLM error samples\n\n")
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
    parser.add_argument("--max-candidates", type=int, default=40)
    parser.add_argument("--max-created", type=int, default=None)
    parser.add_argument("--max-llm-attempts", type=int, default=None)
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
