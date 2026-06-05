import dayjs from "dayjs";

import {
  CollectionType,
  ContentStatus,
  ContentTag,
  getContentItemBySlug,
  getContentItems,
} from "@workspace/cms";
import { SortOrder } from "@workspace/shared/constants";

export const ARTICLE_CATEGORY_OPTIONS = [
  { value: "all", label: "全部分类" },
  { value: ContentTag.PREDIABETES, label: "糖尿病前期" },
  { value: ContentTag.INSULIN_RESISTANCE, label: "胰岛素抵抗" },
  { value: ContentTag.LIFESTYLE, label: "生活方式" },
  { value: ContentTag.MEDICAL_RESEARCH, label: "医学研究" },
] as const;

export type ArticleCategory =
  (typeof ARTICLE_CATEGORY_OPTIONS)[number]["value"];
export type ArticleSort = "newest" | "oldest";

export type Article = {
  slug: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  bodyZh: string;
  bodyEn: string;
  source: string;
  doi?: string;
  originalUrl?: string;
  publishedAt: Date;
  publishedAtLabel: string;
  draft: boolean;
  contentPath: string;
  tags: string[];
  categoryLabels: string[];
};

const ARTICLE_TAGS = new Set<string>([
  ContentTag.MEDICAL_RESEARCH,
  ContentTag.PREDIABETES,
  ContentTag.INSULIN_RESISTANCE,
  ContentTag.LIFESTYLE,
]);

const TAG_LABELS: Record<string, string> = {
  [ContentTag.MEDICAL_RESEARCH]: "医学研究",
  [ContentTag.PREDIABETES]: "糖尿病前期",
  [ContentTag.INSULIN_RESISTANCE]: "胰岛素抵抗",
  [ContentTag.LIFESTYLE]: "生活方式",
};

const SOURCE_FALLBACK = "国际医学期刊";

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
  const raw =
    typeof endIndex === "number"
      ? content.slice(bodyStart, endIndex)
      : content.slice(bodyStart);

  return raw
    .replace(/^#+\s+.+$/gm, "")
    .replace(/^>\s?.+$/gm, "")
    .trim();
};

const cleanSummary = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .replace(/本文仅供科普参考，不构成医疗建议。?/g, "")
    .trim();

const firstParagraph = (text: string, fallback: string) =>
  cleanSummary(
    text
      .split(/\n{2,}/)
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .find(Boolean) || fallback,
  );

const metadataLine = (content: string, label: string) => {
  const regex = new RegExp(`^- ${label}:\\s*(.+)$`, "im");
  return content.match(regex)?.[1]?.trim();
};

const firstMetadataLink = (content: string, labels: string[]) =>
  labels
    .map((label) => metadataLine(content, label))
    .map(markdownLinkUrl)
    .find(Boolean);

const markdownLinkUrl = (value?: string) =>
  value?.match(/\((https?:\/\/[^)]+)\)/)?.[1] ||
  value?.match(/https?:\/\/\S+/)?.[0]?.replace(/[.)]+$/, "");

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
  tags.some((tag) => ARTICLE_TAGS.has(tag));

const toArticle = (
  item: ReturnType<
    typeof getContentItems<typeof CollectionType.BLOG>
  >["items"][number],
): Article => {
  const { titleZh, titleEn } = splitBilingualTitle(item.title);
  const bodyZh = sectionBetweenAny(
    item.content,
    ["## 原文精华摘要", "## 中文白话版"],
    ["## English Plain-Language Version", "## Plain-English Version"],
  );
  const bodyEn = sectionBetweenAny(
    item.content,
    ["## English Plain-Language Version", "## Plain-English Version"],
    ["## Source"],
  );
  const source =
    metadataLine(item.content, "Journal/source") || SOURCE_FALLBACK;
  const originalUrl = firstMetadataLink(item.content, [
    "Link",
    "PubMed",
    "Open-access link",
    "DOI",
  ]);
  const doi = inferDoi(item.content);
  const textForLabels = `${item.title} ${item.description} ${bodyZh} ${bodyEn}`;

  return {
    slug: item.slug,
    titleZh,
    titleEn,
    summaryZh: firstParagraph(bodyZh, item.description),
    summaryEn: firstParagraph(bodyEn, item.description),
    bodyZh: bodyZh || item.description,
    bodyEn: bodyEn || item.description,
    source,
    doi,
    originalUrl,
    publishedAt: item.publishedAt,
    publishedAtLabel: dayjs(item.publishedAt).format("YYYY-MM-DD"),
    draft: item.draft,
    contentPath: `packages/cms/src/collections/blog/content/${item.slug}/en.mdx`,
    tags: item.tags,
    categoryLabels: inferCategoryLabels(textForLabels, item.tags),
  };
};

export const getPublishedArticles = ({
  category = "all",
  sort = "newest",
  limit,
}: {
  category?: string;
  sort?: string;
  limit?: number;
} = {}) => {
  const { items } = getContentItems({
    collection: CollectionType.BLOG,
    status: ContentStatus.PUBLISHED,
    sortBy: "publishedAt",
    sortOrder: sort === "oldest" ? SortOrder.ASCENDING : SortOrder.DESCENDING,
    locale: "en",
  });

  const articles = items
    .filter((item) => isResearchArticle(item.tags))
    .filter(
      (item) =>
        category === "all" || item.tags.includes(category as ContentTag),
    )
    .map(toArticle);

  return typeof limit === "number" ? articles.slice(0, limit) : articles;
};

export const getPublishedArticleBySlug = (slug: string) => {
  const item = getContentItemBySlug({
    collection: CollectionType.BLOG,
    slug,
    status: ContentStatus.PUBLISHED,
    locale: "en",
  });

  if (!item || !isResearchArticle(item.tags)) {
    return null;
  }

  return toArticle(item);
};

export const getAllPublishedArticleSlugs = () =>
  getPublishedArticles().map((article) => ({ slug: article.slug }));

export const getReviewArticles = () => {
  const { items } = getContentItems({
    collection: CollectionType.BLOG,
    status: ContentStatus.PUBLISHED,
    sortBy: "publishedAt",
    sortOrder: SortOrder.DESCENDING,
    locale: "en",
    includeDrafts: true,
  });

  return items.filter((item) => isResearchArticle(item.tags)).map(toArticle);
};

export const getReviewArticleBySlug = (slug: string) => {
  const item = getContentItemBySlug({
    collection: CollectionType.BLOG,
    slug,
    status: ContentStatus.PUBLISHED,
    locale: "en",
    includeDrafts: true,
  });

  if (!item || !isResearchArticle(item.tags)) {
    return null;
  }

  return toArticle(item);
};
