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
  topic?: string;
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
  titleKeywords?: string[];
  minTitleMatches?: number;
  minTotalMatches?: number;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const clampFutureDate = (value?: Date | string) => {
  const date = dayjs(value).isValid()
    ? dayjs(value).format("YYYY-MM-DD")
    : todayIso();

  return date > todayIso() ? todayIso() : date;
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
    titleKeywords: ["CGM", "动态血糖", "连续血糖", "continuous glucose"],
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
      "膳食",
      "早餐",
      "主食",
      "蛋白质",
      "纤维",
      "镁",
      "diet",
      "nutrition",
      "protein",
      "fiber",
      "magnesium",
    ],
    titleKeywords: [
      "饮食",
      "营养",
      "膳食",
      "早餐",
      "蛋白质",
      "纤维",
      "镁",
      "diet",
      "nutrition",
      "protein",
      "fiber",
      "magnesium",
    ],
  },
  {
    slug: "exercise-sleep",
    title: "运动睡眠",
    kicker: "Exercise & sleep",
    description:
      "聚焦饭后步行、有氧、抗阻训练、肌肉量、身体成分、睡眠节律和恢复，把运动睡眠拆成可执行路线。",
    intent: "适合搜索“糖尿病前期运动多久有效”“饭后走路降血糖”的读者。",
    searchKeywords: [
      "糖尿病前期运动多久有效",
      "饭后走路降血糖",
      "抗阻训练 糖尿病前期",
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
      "步行",
      "有氧",
      "抗阻",
      "力量训练",
      "肌肉",
      "内脏脂肪",
      "身体成分",
      "骨骼肌",
      "exercise",
      "walking",
      "sleep",
      "muscle",
      "visceral fat",
      "skeletal muscle",
      "body composition",
      "strength training",
      "resistance training",
      "muscle-to-visceral",
    ],
    titleKeywords: [
      "运动",
      "睡眠",
      "步行",
      "有氧",
      "抗阻",
      "力量训练",
      "肌肉",
      "内脏脂肪",
      "身体成分",
      "骨骼肌",
      "exercise",
      "walking",
      "sleep",
      "muscle",
      "visceral fat",
      "skeletal muscle",
      "body composition",
      "strength training",
      "resistance training",
      "muscle-to-visceral",
    ],
    minTitleMatches: 1,
  },
  {
    slug: "stress-emotion",
    title: "情绪管理",
    kicker: "Stress & emotion",
    description:
      "追踪压力、情绪、睡眠质量、皮质醇和行为坚持度，帮助读者理解心理状态如何影响血糖与代谢。",
    intent: "适合搜索“压力会让血糖升高吗”“情绪和胰岛素抵抗”的读者。",
    searchKeywords: [
      "压力会让血糖升高吗",
      "情绪和胰岛素抵抗",
      "stress glucose metabolism",
      "stress management prediabetes",
    ],
    interventions: [
      "记录压力场景和餐后血糖波动",
      "建立可持续的睡前放松和恢复流程",
      "把情绪触发的加餐、熬夜和久坐纳入干预计划",
    ],
    articleKeywords: [
      "压力",
      "情绪",
      "焦虑",
      "抑郁",
      "皮质醇",
      "心理",
      "stress",
      "emotion",
      "anxiety",
      "depression",
      "cortisol",
      "mental health",
    ],
    titleKeywords: [
      "压力",
      "情绪",
      "焦虑",
      "抑郁",
      "皮质醇",
      "心理",
      "stress",
      "emotion",
      "anxiety",
      "depression",
      "cortisol",
      "mental health",
    ],
    minTitleMatches: 1,
  },
  {
    slug: "metabolic-health",
    title: "代谢健康",
    kicker: "Metabolic health",
    description:
      "把肝脏脂肪、胰岛素敏感性、血脂、炎症、身体成分和长期疾病风险放在同一张代谢地图里。",
    intent: "适合搜索“代谢健康怎么改善”“糖尿病前期和脂肪肝”的读者。",
    searchKeywords: [
      "代谢健康怎么改善",
      "糖尿病前期和脂肪肝",
      "metabolic health prediabetes",
      "metabolic syndrome insulin resistance",
    ],
    interventions: [
      "同时看血糖、血脂、腰围、肝酶和炎症指标",
      "区分体重、脂肪分布、胰岛素敏感性和 β 细胞功能",
      "把单篇研究放回整体代谢风险框架里判断",
    ],
    articleKeywords: [
      "代谢",
      "脂肪肝",
      "肝脏",
      "血脂",
      "炎症",
      "心血管",
      "胰岛素抵抗",
      "metabolic",
      "metabolism",
      "fatty liver",
      "liver",
      "cardiovascular",
      "inflammation",
      "insulin resistance",
    ],
    minTotalMatches: 2,
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
    ["## 解读与批判", "## Source", "## Research Primer / 参考文献"],
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
  const publishedAtLabel = clampFutureDate(item.publishedAt);

  return {
    slug: item.slug,
    titleZh,
    titleEn: titleEn === titleZh ? referenceTitle : titleEn,
    summaryZh: firstParagraph(bodyZh, item.description),
    summaryEn: firstParagraph(bodyEn, item.description),
    bodyZh: bodyZh || item.description,
    bodyEn: bodyEn || item.description,
    thumbnail: item.thumbnail,
    source,
    doi,
    originalUrl,
    publishedAt: new Date(`${publishedAtLabel}T00:00:00.000Z`),
    publishedAtLabel,
    draft: item.draft,
    reviewRequired: item.reviewRequired,
    qualityStatus: item.qualityStatus,
    qualityIssues: item.qualityIssues,
    topic: item.topic,
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
        !item.draft &&
        !item.reviewRequired &&
        item.qualityStatus !== "needs_revision",
    )
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

  if (
    !item ||
    !isResearchArticle(item.tags) ||
    item.draft ||
    item.reviewRequired ||
    item.qualityStatus === "needs_revision"
  ) {
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
  const titleHaystack = [article.titleZh, article.titleEn]
    .join(" ")
    .toLowerCase();

  const primaryHaystack = [
    article.titleZh,
    article.titleEn,
    article.summaryZh,
    article.summaryEn,
  ]
    .join(" ")
    .toLowerCase();

  const secondaryHaystack = [
    article.bodyZh,
    article.bodyEn,
    article.categoryLabels.join(" "),
    article.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  const titleKeywords = topic.titleKeywords ?? topic.articleKeywords;
  const titleMatches = titleKeywords.filter((keyword) =>
    titleHaystack.includes(keyword.toLowerCase()),
  ).length;
  const totalMatches = topic.articleKeywords.filter((keyword) => {
    const normalized = keyword.toLowerCase();

    return (
      primaryHaystack.includes(normalized) ||
      secondaryHaystack.includes(normalized)
    );
  }).length;

  if (titleMatches < (topic.minTitleMatches ?? 0)) {
    return 0;
  }

  if (totalMatches < (topic.minTotalMatches ?? 1)) {
    return 0;
  }

  return titleMatches * 4 + totalMatches;
};

export const getTopicClusterBySlug = (slug: string) =>
  TOPIC_CLUSTERS.find((topic) => topic.slug === slug);

const getTopicClusterScores = (article: Article) =>
  TOPIC_CLUSTERS.map((topic, index) => ({
    topic,
    index,
    score: topicScore(article, topic),
  })).sort((a, b) => b.score - a.score || a.index - b.index);

export const getTopicClusterArticles = (slug: string, limit?: number) => {
  const topic = getTopicClusterBySlug(slug);

  if (!topic) {
    return [];
  }

  const articles = getPublishedArticles()
    .map((article) => ({
      article,
      score: article.topic === slug ? 1000 : topicScore(article, topic),
      primaryTopic: article.topic
        ? getTopicClusterBySlug(article.topic)
        : getTopicClusterScores(article).find(({ score }) => score > 0)?.topic,
    }))
    .filter(
      ({ primaryTopic, score }) => score > 0 && primaryTopic?.slug === slug,
    )
    .sort((a, b) => b.score - a.score)
    .map(({ article }) => article);

  return typeof limit === "number" ? articles.slice(0, limit) : articles;
};

export const getPrimaryTopicCluster = (article: Article) =>
  (article.topic ? getTopicClusterBySlug(article.topic) : undefined) ??
  getTopicClusterScores(article).find(({ score }) => score > 0)?.topic ??
  TOPIC_CLUSTERS[0]!;

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
