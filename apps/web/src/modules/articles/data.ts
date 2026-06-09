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
  { value: "all", label: "全部主题" },
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
  thumbnail: string;
  source: string;
  doi?: string;
  originalUrl?: string;
  publishedAt: Date;
  publishedAtLabel: string;
  draft: boolean;
  reviewRequired: boolean;
  qualityStatus: string;
  qualityIssues: string[];
  contentPath: string;
  tags: string[];
  categoryLabels: string[];
  authors: string;
  referenceTitle: string;
  referenceLinks: { label: string; href: string }[];
  evidenceLabel: string;
  reviewStatusLabel: string;
};

export type TopicCluster = {
  slug: string;
  title: string;
  kicker: string;
  description: string;
  intent: string;
  searchKeywords: string[];
  interventions: string[];
  articleKeywords: string[];
};

export const TOPIC_CLUSTERS: TopicCluster[] = [
  {
    slug: "prediabetes",
    title: "糖前基础",
    kicker: "Prediabetes 101",
    description:
      "解释糖尿病前期、OGTT、HbA1c、空腹血糖和不同糖前亚型，帮助读者先判断自己处在哪个风险阶段。",
    intent: "适合搜索“糖尿病前期怎么逆转”“糖尿病前期多久会变糖尿病”的读者。",
    searchKeywords: [
      "糖尿病前期怎么逆转",
      "糖尿病前期诊断标准",
      "prediabetes lifestyle intervention",
      "how to reverse prediabetes",
    ],
    interventions: [
      "确认 HbA1c、空腹血糖和 OGTT 基线",
      "识别体重、腰围、家族史和餐后血糖风险",
      "把生活方式干预拆成可记录的 2-4 周实验",
    ],
    articleKeywords: ["糖尿病前期", "prediabetes", "diabetes prevention"],
  },
  {
    slug: "insulin-resistance",
    title: "胰岛素抵抗",
    kicker: "Insulin resistance",
    description:
      "围绕空腹胰岛素、HOMA-IR、脂肪肝、腰围和餐后血糖，建立一套普通人能理解的胰岛素抵抗地图。",
    intent:
      "适合搜索“空腹胰岛素高怎么办”“how to lower fasting insulin”的读者。",
    searchKeywords: [
      "空腹胰岛素高怎么办",
      "胰岛素抵抗怎么改善",
      "how to lower fasting insulin",
      "insulin resistance diet plan",
    ],
    interventions: [
      "减少液体糖和高精制碳水",
      "加入抗阻训练和饭后步行",
      "同时追踪腰围、甘油三酯和餐后血糖",
    ],
    articleKeywords: ["胰岛素抵抗", "insulin", "homa-ir", "fasting insulin"],
  },
  {
    slug: "cgm",
    title: "CGM 监测",
    kicker: "Glucose tracking",
    description:
      "用动态血糖理解个人化餐后反应，重点讨论 CGM 是否适合糖前、如何避免数据焦虑、哪些指标最值得看。",
    intent:
      "适合搜索“CGM 对糖尿病前期有用吗”“continuous glucose monitoring for prediabetes”的读者。",
    searchKeywords: [
      "CGM 对糖尿病前期有用吗",
      "动态血糖监测糖前",
      "continuous glucose monitoring for prediabetes",
      "continuous glucose monitoring for weight loss",
    ],
    interventions: [
      "观察餐后峰值和回落时间",
      "比较不同早餐、主食和饭后步行方案",
      "把 CGM 当作短期学习工具，而不是长期焦虑来源",
    ],
    articleKeywords: ["CGM", "动态血糖", "连续血糖", "continuous glucose"],
  },
  {
    slug: "diet",
    title: "饮食干预",
    kicker: "Diet",
    description:
      "聚焦蛋白质、膳食纤维、低 GI 主食、进食顺序、补充剂和体重管理，先给可执行清单，再放研究证据。",
    intent: "适合搜索“糖尿病前期饮食怎么吃”“糖尿病前期早餐怎么吃”的读者。",
    searchKeywords: [
      "糖尿病前期饮食怎么吃",
      "糖尿病前期早餐",
      "糖尿病前期能吃水果吗",
      "prediabetes diet plan",
    ],
    interventions: [
      "每餐先保证蛋白质和蔬菜",
      "减少含糖饮料和精制主食",
      "用体重、腰围和餐后血糖评估饮食调整",
    ],
    articleKeywords: [
      "饮食",
      "营养",
      "diet",
      "nutrition",
      "protein",
      "fiber",
      "magnesium",
      "weight",
    ],
  },
  {
    slug: "exercise-sleep",
    title: "运动睡眠",
    kicker: "Exercise & sleep",
    description:
      "把饭后步行、Zone 2、有氧、抗阻训练、睡眠节律和压力管理放在同一张代谢改善路线图里。",
    intent: "适合搜索“糖尿病前期运动多久有效”“饭后走路降血糖”的读者。",
    searchKeywords: [
      "糖尿病前期运动多久有效",
      "饭后走路降血糖",
      "Zone 2 training insulin resistance",
      "sleep and insulin resistance",
    ],
    interventions: [
      "饭后 10-20 分钟步行",
      "每周 150 分钟中等强度运动",
      "每周 2-3 次抗阻训练，并固定起床时间",
    ],
    articleKeywords: [
      "运动",
      "睡眠",
      "压力",
      "exercise",
      "activity",
      "walking",
      "sleep",
      "stress",
    ],
  },
  {
    slug: "supplements-medications",
    title: "药物与补剂前沿",
    kicker: "Supplements & medications",
    description:
      "追踪二甲双胍、GLP-1、镁、维生素 D、肌酸等干预的证据等级、适用人群、成本和安全边界。",
    intent: "适合搜索“糖尿病前期需要吃二甲双胍吗”“糖前补剂有用吗”的读者。",
    searchKeywords: [
      "糖尿病前期需要吃二甲双胍吗",
      "糖尿病前期补剂",
      "metformin for prediabetes",
      "magnesium supplementation prediabetes",
    ],
    interventions: [
      "先确认是否存在缺乏或明确适应证",
      "核查剂量、安全性和药物相互作用",
      "不要用补剂替代饮食、运动和医生随访",
    ],
    articleKeywords: [
      "药物",
      "补剂",
      "metformin",
      "glp",
      "semaglutide",
      "magnesium",
      "supplement",
      "medication",
    ],
  },
];

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

  tags.forEach((tag) => {
    const label = TAG_LABELS[tag];

    if (label) {
      labels.add(label);
    }
  });

  if (
    /diet|nutrition|meal|food|weight|exercise|physical activity|walking|fitness|饮食|营养|体重|运动|步行|锻炼/.test(
      haystack,
    )
  ) {
    labels.add("生活方式");
  }
  if (/insulin|homa-ir|胰岛素|胰岛素抵抗/.test(haystack)) {
    labels.add("胰岛素抵抗");
  }
  if (/cgm|continuous glucose|连续血糖|动态血糖/.test(haystack)) {
    labels.add("CGM");
  }
  if (
    /metformin|glp-?1|semaglutide|drug|medication|药物|二甲双胍/.test(haystack)
  ) {
    labels.add("药物研究");
  }

  return Array.from(labels).slice(0, 4);
};

const inferEvidenceLabel = (text: string) => {
  const haystack = text.toLowerCase();

  if (
    /meta-analysis|systematic review|荟萃|系统综述|meta regression/.test(
      haystack,
    )
  ) {
    return "荟萃";
  }
  if (/randomized|randomised|rct|trial|随机/.test(haystack)) {
    return "RCT";
  }
  if (
    /cohort|observational|cross-sectional|cluster analysis|队列|观察|聚类/.test(
      haystack,
    )
  ) {
    return "观察";
  }

  return "专家";
};

const isResearchArticle = (tags: string[]) =>
  tags.some((tag) => ARTICLE_TAGS.has(tag));

const buildReferenceLinks = (
  content: string,
  doi?: string,
  originalUrl?: string,
) => {
  const links = new Map<string, string>();
  const pubmed = firstMetadataLink(content, ["PubMed", "PubMed/source link"]);
  const openAccess = firstMetadataLink(content, ["Open-access link"]);

  if (doi) {
    links.set("DOI", `https://doi.org/${doi}`);
  }
  if (pubmed) {
    links.set("PubMed", pubmed);
  }
  if (openAccess) {
    links.set("开放获取链接", openAccess);
  }
  if (originalUrl) {
    links.set("原文链接", originalUrl);
  }

  return Array.from(links, ([label, href]) => ({ label, href }));
};

const toArticle = (
  item: ReturnType<
    typeof getContentItems<typeof CollectionType.BLOG>
  >["items"][number],
): Article => {
  const { titleZh, titleEn } = splitBilingualTitle(item.title);
  const bodyZh = sectionBetweenAny(
    item.content,
    ["## 原文精华摘要", "## 中文白话版", "## 鍘熸枃绮惧崕鎽樿"],
    ["## English Plain-Language Version", "## Plain-English Version"],
  );
  const bodyEn = sectionBetweenAny(
    item.content,
    ["## English Plain-Language Version", "## Plain-English Version"],
    ["## 解读与批判", "## Source"],
  );
  const source =
    metadataLine(item.content, "Journal/source") || SOURCE_FALLBACK;
  const originalUrl = firstMetadataLink(item.content, [
    "Link",
    "PubMed",
    "PubMed/source link",
    "Open-access link",
    "DOI",
  ]);
  const doi = inferDoi(item.content);
  const authors = metadataLine(item.content, "Authors") || "GLUCOLIT 编辑部";
  const referenceTitle =
    metadataLine(item.content, "Original title") || item.title;
  const textForLabels = `${item.title} ${item.description} ${bodyZh} ${bodyEn}`;
  const evidenceText = `${item.title} ${item.description} ${referenceTitle} ${bodyEn}`;

  return {
    slug: item.slug,
    titleZh,
    titleEn,
    summaryZh: firstParagraph(bodyZh, item.description),
    summaryEn: firstParagraph(bodyEn, item.description),
    bodyZh: bodyZh || item.description,
    bodyEn: bodyEn || item.description,
    thumbnail: item.thumbnail,
    source,
    doi,
    originalUrl,
    publishedAt: item.publishedAt,
    publishedAtLabel: dayjs(item.publishedAt).format("YYYY-MM-DD"),
    draft: item.draft,
    reviewRequired: item.reviewRequired,
    qualityStatus: item.qualityStatus,
    qualityIssues: item.qualityIssues,
    contentPath: `packages/cms/src/collections/blog/content/${item.slug}/en.mdx`,
    tags: item.tags,
    categoryLabels: inferCategoryLabels(textForLabels, item.tags),
    authors,
    referenceTitle,
    referenceLinks: buildReferenceLinks(item.content, doi, originalUrl),
    evidenceLabel: inferEvidenceLabel(evidenceText),
    reviewStatusLabel: item.reviewRequired ? "需复核" : "已审核",
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

export const getRelatedPublishedArticles = (article: Article, limit = 3) => {
  const articleTags = new Set(article.tags);

  return getPublishedArticles()
    .filter((item) => item.slug !== article.slug)
    .map((item) => ({
      item,
      score: item.tags.filter((tag) => articleTags.has(tag)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
};

const topicScore = (article: Article, topic: TopicCluster) => {
  const haystack = [
    article.titleZh,
    article.titleEn,
    article.summaryZh,
    article.summaryEn,
    article.bodyZh,
    article.bodyEn,
    article.categoryLabels.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return topic.articleKeywords.reduce(
    (score, keyword) =>
      haystack.includes(keyword.toLowerCase()) ? score + 1 : score,
    0,
  );
};

export const getTopicClusterBySlug = (slug: string) =>
  TOPIC_CLUSTERS.find((topic) => topic.slug === slug);

export const getTopicClusterArticles = (slug: string, limit?: number) => {
  const topic = getTopicClusterBySlug(slug);

  if (!topic) {
    return [];
  }

  const articles = getPublishedArticles()
    .map((article) => ({
      article,
      score: topicScore(article, topic),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ article }) => article);

  return typeof limit === "number" ? articles.slice(0, limit) : articles;
};

export const getPrimaryTopicCluster = (article: Article) =>
  TOPIC_CLUSTERS.map((topic) => ({
    topic,
    score: topicScore(article, topic),
  }))
    .sort((a, b) => b.score - a.score)
    .find(({ score }) => score > 0)?.topic ?? TOPIC_CLUSTERS[0]!;

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
