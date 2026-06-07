import dayjs from "dayjs";
import fs from "node:fs";
import path from "node:path";

import type { Article } from "./data";

const contentRootCandidates = [
  path.join(
    process.cwd(),
    "..",
    "..",
    "packages",
    "cms",
    "src",
    "collections",
    "blog",
    "content",
  ),
  path.join(
    process.cwd(),
    "packages",
    "cms",
    "src",
    "collections",
    "blog",
    "content",
  ),
];

const CONTENT_ROOT: string =
  contentRootCandidates.find((candidate) => fs.existsSync(candidate)) ||
  contentRootCandidates[0] ||
  "";

const RESEARCH_TAGS = new Set([
  "medical-research",
  "prediabetes",
  "insulin-resistance",
  "lifestyle",
]);

const TAG_LABELS: Record<string, string> = {
  "medical-research": "医学研究",
  prediabetes: "糖尿病前期",
  "insulin-resistance": "胰岛素抵抗",
  lifestyle: "生活方式",
};

const SOURCE_FALLBACK = "国际医学期刊";

const frontmatterValue = (frontmatter: string, key: string) =>
  frontmatter
    .match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "") || "";

const frontmatterArray = (frontmatter: string, key: string) => {
  const raw = frontmatterValue(frontmatter, key);

  if (!raw.startsWith("[") || !raw.endsWith("]")) {
    return [];
  }

  return raw
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
};

const frontmatterBool = (frontmatter: string, key: string) =>
  /^true$/i.test(frontmatterValue(frontmatter, key));

const parseMdx = (raw: string) => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  return {
    frontmatter: match?.[1] || "",
    content: match?.[2] || raw,
  };
};

const splitBilingualTitle = (title: string) => {
  const [zh, ...enParts] = title.split(" / ");

  return {
    titleZh: zh?.trim() || title,
    titleEn: enParts.join(" / ").trim() || title,
  };
};

const sectionBetweenAny = (
  content: string,
  starts: string[],
  ends: string[] = [],
) => {
  const matches = starts
    .map((start) => ({ start, index: content.indexOf(start) }))
    .filter(({ index }) => index !== -1)
    .sort((a, b) => a.index - b.index);

  if (!matches[0]) {
    return "";
  }

  const bodyStart = matches[0].index + matches[0].start.length;
  const endIndex = ends
    .map((end) => content.indexOf(end, bodyStart))
    .filter((index) => index !== -1)
    .sort((a, b) => a - b)[0];

  return (
    typeof endIndex === "number"
      ? content.slice(bodyStart, endIndex)
      : content.slice(bodyStart)
  )
    .replace(/^#+\s+.+$/gm, "")
    .replace(/^>\s?.+$/gm, "")
    .trim();
};

const cleanSummary = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .replace(/本文仅供科普参考，不构成医疗建议。/g, "")
    .trim();

const firstParagraph = (text: string, fallback: string) =>
  cleanSummary(
    text
      .split(/\n{2,}/)
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .find(Boolean) || fallback,
  );

const metadataLine = (content: string, label: string) =>
  content.match(new RegExp(`^- ${label}:\\s*(.+)$`, "im"))?.[1]?.trim();

const markdownLinkUrl = (value?: string) =>
  value?.match(/\((https?:\/\/[^)]+)\)/)?.[1] ||
  value?.match(/https?:\/\/\S+/)?.[0]?.replace(/[.)]+$/, "");

const firstMetadataLink = (content: string, labels: string[]) =>
  labels
    .map((label) => metadataLine(content, label))
    .map(markdownLinkUrl)
    .find(Boolean);

const inferDoi = (content: string) =>
  content.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i)?.[0];

const inferCategoryLabels = (text: string, tags: string[]) => {
  const labels = new Set<string>();
  const haystack = text.toLowerCase();

  if (/diet|nutrition|meal|food|weight|饮食|营养|体重/.test(haystack)) {
    labels.add("饮食干预");
  }
  if (
    /exercise|physical activity|walking|fitness|运动|步行|锻炼/.test(haystack)
  ) {
    labels.add("运动");
  }
  if (
    /metformin|glp-?1|semaglutide|drug|medication|药物|二甲双胍/.test(haystack)
  ) {
    labels.add("药物");
  }
  if (/sleep|stress|睡眠|压力/.test(haystack)) {
    labels.add("生活方式");
  }

  tags.forEach((tag) => {
    const label = TAG_LABELS[tag];

    if (label) {
      labels.add(label);
    }
  });

  return Array.from(labels).slice(0, 4);
};

const isResearchArticle = (tags: string[]) =>
  tags.some((tag) => RESEARCH_TAGS.has(tag));

const readReviewArticle = (slug: string): Article | null => {
  const filePath = path.join(CONTENT_ROOT, slug, "en.mdx");

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const { frontmatter, content } = parseMdx(raw);
  const tags = frontmatterArray(frontmatter, "tags");

  if (!isResearchArticle(tags)) {
    return null;
  }

  const title = frontmatterValue(frontmatter, "title");
  const description = frontmatterValue(frontmatter, "description");
  const { titleZh, titleEn } = splitBilingualTitle(title);
  const bodyZh = sectionBetweenAny(
    content,
    ["## 原文精华摘要", "## 中文白话版"],
    ["## English Plain-Language Version", "## Plain-English Version"],
  );
  const bodyEn = sectionBetweenAny(
    content,
    ["## English Plain-Language Version", "## Plain-English Version"],
    ["## Source", "## 原文与文件"],
  );
  const publishedAt = new Date(
    frontmatterValue(frontmatter, "publishedAt") || Date.now(),
  );
  const textForLabels = `${title} ${description} ${bodyZh} ${bodyEn}`;

  return {
    slug,
    titleZh,
    titleEn,
    summaryZh: firstParagraph(bodyZh, description),
    summaryEn: firstParagraph(bodyEn, description),
    bodyZh: bodyZh || description,
    bodyEn: bodyEn || description,
    thumbnail: frontmatterValue(frontmatter, "thumbnail"),
    source: metadataLine(content, "Journal/source") || SOURCE_FALLBACK,
    doi: inferDoi(content),
    originalUrl: firstMetadataLink(content, [
      "Link",
      "PubMed",
      "Open-access link",
      "DOI",
    ]),
    publishedAt,
    publishedAtLabel: dayjs(publishedAt).format("YYYY-MM-DD"),
    draft: frontmatterBool(frontmatter, "draft"),
    reviewRequired: frontmatterBool(frontmatter, "reviewRequired"),
    qualityStatus: frontmatterValue(frontmatter, "qualityStatus") || "ready",
    qualityIssues: frontmatterArray(frontmatter, "qualityIssues"),
    contentPath: `packages/cms/src/collections/blog/content/${slug}/en.mdx`,
    tags,
    categoryLabels: inferCategoryLabels(textForLabels, tags),
  };
};

export const getReviewArticlesFromFiles = () => {
  if (!fs.existsSync(CONTENT_ROOT)) {
    return [];
  }

  return fs
    .readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readReviewArticle(entry.name))
    .filter((article): article is Article => Boolean(article))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
};

export const getReviewArticleFromFileBySlug = (slug: string) =>
  readReviewArticle(slug);
