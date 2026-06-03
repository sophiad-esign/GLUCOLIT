#!/usr/bin/env python3
"""Fetch diabetes-related RSS feeds and turn relevant papers into MDX drafts.

The script is intentionally dependency-free so it can run in GitHub Actions
without installing Python packages. If OPENAI_API_KEY is present, it asks a
language model to create a bilingual plain-language summary. Generated posts
are drafts by default and require human review before publication.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import textwrap
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = REPO_ROOT / "packages/cms/src/collections/blog/content"
STATE_PATH = REPO_ROOT / "data/glucolit-rss-state.json"

RSS_FEEDS = {
    "Lancet Diabetes & Endocrinology": "https://www.thelancet.com/rss/journal/landia",
    "Nature Metabolism": "https://www.nature.com/natmetab.rss",
    "Diabetes Care (ADA)": "https://diabetesjournals.org/care/rss",
    "PubMed prediabetes": "https://pubmed.ncbi.nlm.nih.gov/rss/search/1nP-1wF1RzGJ8v8/?limit=15&utm_campaign=pubmed-2&fc=20250601",
}

PUBMED_FALLBACK_QUERIES = {
    "Lancet Diabetes & Endocrinology": (
        '"Lancet Diabetes Endocrinol"[Journal] AND '
        '(prediabetes OR "insulin resistance" OR "lifestyle intervention" OR "diabetes prevention")'
    ),
    "Nature Metabolism": (
        '"Nature Metabolism"[Journal] AND '
        '(prediabetes OR "insulin resistance" OR "lifestyle intervention" OR metabolism)'
    ),
    "Diabetes Care (ADA)": (
        '"Diabetes Care"[Journal] AND '
        '(prediabetes OR "insulin resistance" OR "lifestyle intervention" OR "diabetes prevention")'
    ),
    "PubMed prediabetes": (
        'prediabetes AND ("insulin resistance" OR "lifestyle intervention" OR '
        '"diabetes prevention" OR exercise OR diet)'
    ),
}

THUMBNAIL = (
    "https://images.unsplash.com/photo-1576671081837-49000212a370"
    "?q=80&w=1800&auto=format&fit=crop"
)

POSITIVE_KEYWORDS = {
    "prediabetes": 6,
    "pre-diabetes": 6,
    "pre diabetes": 6,
    "impaired fasting glucose": 6,
    "impaired glucose tolerance": 6,
    "insulin resistance": 6,
    "insulin sensitivity": 5,
    "type 2 diabetes prevention": 5,
    "diabetes prevention": 5,
    "lifestyle intervention": 5,
    "lifestyle modification": 5,
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


@dataclass
class FeedItem:
    source: str
    title: str
    link: str
    summary: str
    published_at: str


def fetch_text(url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "GLUCOLIT RSS monitor/1.0 (+https://glucolit.vercel.app)",
            "Accept": "application/rss+xml, application/atom+xml, text/xml, */*",
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


def text_of(element: ET.Element | None) -> str:
    if element is None or element.text is None:
        return ""
    return strip_html(element.text)


def child_text(item: ET.Element, names: tuple[str, ...]) -> str:
    for child in list(item):
        local = child.tag.split("}", 1)[-1].lower()
        if local in names:
            value = text_of(child)
            if value:
                return value
    return ""


def child_link(item: ET.Element) -> str:
    for child in list(item):
        local = child.tag.split("}", 1)[-1].lower()
        if local == "link":
            href = child.attrib.get("href")
            if href:
                return href.strip()
            if child.text:
                return child.text.strip()
    return ""


def parse_date(value: str) -> str:
    if not value:
        return dt.date.today().isoformat()
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError, IndexError):
        pass
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return dt.date.today().isoformat()


def parse_feed(source: str, xml_text: str) -> list[FeedItem]:
    root = ET.fromstring(xml_text)
    candidates = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    items: list[FeedItem] = []
    for node in candidates:
        title = child_text(node, ("title",))
        link = child_link(node)
        summary = child_text(node, ("description", "summary", "abstract", "encoded"))
        published = child_text(node, ("pubdate", "published", "updated", "date"))
        if title and link:
            items.append(
                FeedItem(
                    source=source,
                    title=title,
                    link=link,
                    summary=summary,
                    published_at=parse_date(published),
                )
            )
    return items


def pubmed_url(path: str, params: dict[str, str]) -> str:
    return (
        f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/{path}?"
        + urllib.parse.urlencode(params)
    )


def fetch_pubmed_fallback(source: str, limit: int) -> list[FeedItem]:
    query = PUBMED_FALLBACK_QUERIES[source]
    search_url = pubmed_url(
        "esearch.fcgi",
        {
            "db": "pubmed",
            "retmode": "json",
            "retmax": str(limit),
            "sort": "pub date",
            "term": query,
        },
    )
    search = json.loads(fetch_text(search_url))
    ids = search.get("esearchresult", {}).get("idlist", [])
    if not ids:
        return []

    fetch_url = pubmed_url(
        "efetch.fcgi",
        {
            "db": "pubmed",
            "retmode": "xml",
            "id": ",".join(ids),
        },
    )
    root = ET.fromstring(fetch_text(fetch_url))
    items: list[FeedItem] = []
    for article in root.findall(".//PubmedArticle"):
        pmid = "".join(article.findtext(".//PMID", default="").split())
        title_node = article.find(".//ArticleTitle")
        title = strip_html("".join(title_node.itertext())) if title_node is not None else ""
        abstract_parts = [
            strip_html("".join(node.itertext()))
            for node in article.findall(".//AbstractText")
        ]
        journal = article.findtext(".//Journal/Title", default=source)
        year = article.findtext(".//PubDate/Year", default="")
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
        published = f"{year or dt.date.today().year}-{int(month_number):02d}-{int(day):02d}"
        if pmid and title:
            items.append(
                FeedItem(
                    source=f"{source} via PubMed ({journal})",
                    title=title,
                    link=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    summary=" ".join(abstract_parts),
                    published_at=published,
                )
            )
    return items


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
    raw = link or title
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


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


def build_prompt(item: FeedItem, matched: list[str]) -> str:
    return textwrap.dedent(
        f"""
        You are helping GLUCOLIT, a public education site for people with
        prediabetes and insulin resistance.

        Turn the source item below into a bilingual plain-language article.
        Base the article only on the title, abstract/RSS summary, source, and
        link shown below. Do not invent study details that are not present.

        Write for ordinary readers, especially people with prediabetes. Use a
        clear, warm, useful style: explain the health meaning, why it matters,
        what the study did, what it did not prove, and what a reader can
        cautiously take away. Avoid academic jargon when possible.

        The Chinese plain-language article should be at least 600 Chinese
        characters when the abstract has enough substance. The English version
        should be a real plain-language rewrite, not a keyword screening note.

        Do not give personal medical advice. Do not overclaim causality.
        Preserve uncertainty. Mention that readers should discuss medical
        decisions with a qualified clinician.

        Return strict JSON with:
        title_en, title_zh, description_en, description_zh,
        plain_en, plain_zh, takeaways_en, takeaways_zh,
        why_relevant_en, why_relevant_zh.

        Source: {item.source}
        Title: {item.title}
        Link: {item.link}
        Published date: {item.published_at}
        Matched relevance keywords: {", ".join(matched)}
        Abstract or RSS summary:
        {item.summary[:4000]}
        """
    ).strip()


def call_openai(prompt: str) -> dict[str, Any] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "input": prompt,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "glucolit_article",
                "schema": {
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
                },
            }
        },
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"OpenAI generation failed: {exc}")
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
        print("OpenAI generation returned non-JSON output.")
        return None


def fallback_article(item: FeedItem, matched: list[str]) -> dict[str, Any]:
    topic = ", ".join(matched[:5]) or "metabolic health"
    title_en = f"Research note: {item.title}"
    title_zh = f"研究速递：{item.title}"
    description_en = (
        f"A GLUCOLIT reading note from {item.source} related to {topic}. "
        "This draft needs human review before being treated as a full translation."
    )
    description_zh = (
        f"来自 {item.source} 的糖前卫士研究速递，主题涉及 {topic}。"
        "这是自动生成的初稿，建议人工复核后再作为正式翻译使用。"
    )
    plain_en = (
        "This item appears relevant because its title or RSS summary matches "
        f"the following GLUCOLIT topics: {topic}. Read the original source for "
        "the complete methods, population, outcomes, and limitations."
    )
    plain_zh = (
        "这篇内容之所以被系统选中，是因为标题或摘要中出现了与糖前卫士关注方向相关的关键词："
        f"{topic}。请点击原文查看完整研究设计、研究对象、结果和局限性。"
    )
    return {
        "title_en": title_en,
        "title_zh": title_zh,
        "description_en": description_en,
        "description_zh": description_zh,
        "plain_en": plain_en,
        "plain_zh": plain_zh,
        "takeaways_en": [
            "This is an automated screening result, not medical advice.",
            "Use the source link to verify the original abstract and article details.",
            "Lifestyle changes should be individualized with qualified clinical guidance.",
        ],
        "takeaways_zh": [
            "这是自动筛选结果，不是医疗建议。",
            "请通过原文链接核对摘要和论文细节。",
            "生活方式调整需要结合个人情况，并咨询合格医疗专业人士。",
        ],
        "why_relevant_en": f"Matched keywords: {topic}.",
        "why_relevant_zh": f"命中关键词：{topic}。",
    }


def is_valid_article(article: dict[str, Any] | None) -> bool:
    if not article:
        return False

    required_strings = [
        "title_en",
        "title_zh",
        "description_en",
        "description_zh",
        "plain_en",
        "plain_zh",
        "why_relevant_en",
        "why_relevant_zh",
    ]
    if any(not str(article.get(key, "")).strip() for key in required_strings):
        return False

    plain_text = f"{article.get('plain_en', '')}\n{article.get('plain_zh', '')}"
    blocked_phrases = [
        "This item appears relevant",
        "automated screening result",
        "Matched keywords",
        "被系统选中",
        "命中关键词",
    ]
    if any(phrase in plain_text for phrase in blocked_phrases):
        return False

    if len(str(article.get("plain_en", ""))) < 500:
        return False
    if len(str(article.get("plain_zh", ""))) < 250:
        return False

    return len(article.get("takeaways_en", [])) >= 2 and len(
        article.get("takeaways_zh", [])
    ) >= 2


def bullet_list(items: list[str]) -> str:
    return "\n".join(f"- {item.strip()}" for item in items if item.strip())


def article_to_mdx(
    item: FeedItem,
    article: dict[str, Any],
    status: str,
    draft: bool,
) -> str:
    title = f"{article['title_zh']} / {article['title_en']}"
    description = f"{article['description_zh']} {article['description_en']}"
    content = textwrap.dedent(
        f"""\
        ---
        title: "{md_escape(title[:180])}"
        description: "{md_escape(description[:260])}"
        publishedAt: {item.published_at}
        tags: {yaml_list(["medical-research", "prediabetes", "lifestyle"])}
        thumbnail: {THUMBNAIL}
        status: {status}
        draft: {str(draft).lower()}
        ---

        > 本文是糖前卫士自动监测国际期刊 RSS 后生成的科普草稿，仅用于健康教育，不构成诊断、治疗或用药建议。任何医疗决定请咨询合格医生或营养专业人士。

        ## 中文白话版

        {article["plain_zh"].strip()}

        ### 为什么和糖尿病前期有关

        {article["why_relevant_zh"].strip()}

        ### 你可以带走的 3 个点

        {bullet_list(article.get("takeaways_zh", []))}

        ## Plain-English Version

        {article["plain_en"].strip()}

        ### Why This Matters for Prediabetes

        {article["why_relevant_en"].strip()}

        ### Three Practical Takeaways

        {bullet_list(article.get("takeaways_en", []))}

        ## Source

        - Journal/source: {item.source}
        - Original title: {item.title}
        - Link: [{item.link}]({item.link})
        - Published or RSS date: {item.published_at}
        """
    )
    content = re.sub(
        r"(?m)^        > .+$",
        "        > 本文是糖前卫士自动监测国际期刊 RSS 后生成的科普草稿，仅用于健康教育，不构成诊断、治疗或用药建议。任何医疗决定请咨询合格医生或营养专业人士。",
        content,
        count=1,
    )
    content = re.sub(
        r"(?m)^        ## .+$", "        ## 中文白话版", content, count=1
    )
    content = re.sub(
        r"(?m)^        ### .+$",
        "        ### 为什么和糖尿病前期有关？",
        content,
        count=1,
    )
    content = re.sub(
        r"(?m)^        ### .+$",
        "        ### 你可以带走的 3 个点",
        content,
        count=1,
    )
    return re.sub(r"(?m)^ {8}", "", content).lstrip()


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
    item: FeedItem,
    item_id: str,
    article: dict[str, Any],
    status: str,
    draft: bool,
) -> Path:
    slug = slugify(item.title, item_id)
    post_dir = CONTENT_ROOT / slug
    post_dir.mkdir(parents=True, exist_ok=True)
    post_path = post_dir / "en.mdx"
    if not post_path.exists():
        post_path.write_text(article_to_mdx(item, article, status, draft), encoding="utf-8")
    return post_path


def run(args: argparse.Namespace) -> int:
    state = load_state()
    min_score = args.min_score
    created: list[Path] = []
    created_count = 0
    scanned = 0

    for source, url in RSS_FEEDS.items():
        if args.max_created is not None and created_count >= args.max_created:
            print(f"Reached max-created={args.max_created}; stopping.")
            break

        print(f"Fetching {source}: {url}")
        try:
            items = parse_feed(source, fetch_text(url))
        except Exception as exc:  # noqa: BLE001 - keep the monitor resilient.
            print(f"Failed to fetch {source}: {exc}")
            print(f"Trying PubMed fallback for {source}.")
            try:
                items = fetch_pubmed_fallback(source, args.limit_per_feed)
            except Exception as fallback_exc:  # noqa: BLE001
                print(f"Failed PubMed fallback for {source}: {fallback_exc}")
                continue

        for item in items[: args.limit_per_feed]:
            if args.max_created is not None and created_count >= args.max_created:
                print(f"Reached max-created={args.max_created}; stopping.")
                break

            scanned += 1
            item_id = stable_id(item.link, item.title)
            if item_id in state["items"]:
                continue

            score, matched = relevance_score(item.title, item.summary)
            state["items"][item_id] = {
                "title": item.title,
                "source": item.source,
                "link": item.link,
                "published_at": item.published_at,
                "score": score,
                "matched": matched,
                "created_at": dt.datetime.now(dt.UTC).isoformat(),
                "generated": False,
            }

            if score < min_score:
                print(f"Skip score={score}: {item.title}")
                continue

            prompt = build_prompt(item, matched)
            article = call_openai(prompt)
            if article is None:
                print(
                    "Skip because OpenAI did not return an article: "
                    f"{item.title}"
                )
                continue
            if not is_valid_article(article):
                print(
                    "Skip incomplete generated article. No draft was written: "
                    f"{item.title}"
                )
                continue
            if args.dry_run:
                print(f"Would create score={score}: {item.title}")
                created_count += 1
                continue

            path = write_article(item, item_id, article, args.status, args.draft)
            created.append(path)
            created_count += 1
            state["items"][item_id]["generated"] = True
            state["items"][item_id]["path"] = str(path.relative_to(REPO_ROOT))
            print(f"Created {path.relative_to(REPO_ROOT)}")
            time.sleep(args.sleep)

    if not args.dry_run:
        save_state(state)
    print(f"Scanned {scanned} items, created {len(created)} article(s).")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit-per-feed", type=int, default=15)
    parser.add_argument(
        "--max-created",
        type=int,
        default=None,
        help="Maximum number of new MDX drafts to create in one run.",
    )
    parser.add_argument("--min-score", type=int, default=8)
    parser.add_argument("--status", choices=("draft", "published"), default="published")
    parser.add_argument("--draft", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--require-openai", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.25)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(run(parse_args()))
