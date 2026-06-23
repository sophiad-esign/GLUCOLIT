import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}web`)
  ? path.resolve(process.cwd(), "..", "..")
  : process.cwd();

const contentRoot = path.join(
  repoRoot,
  "packages",
  "cms",
  "src",
  "collections",
  "blog",
  "content",
);
const outputPath = path.join(
  repoRoot,
  "apps",
  "web",
  "src",
  "modules",
  "articles",
  "review-manifest.generated.ts",
);

const researchTags = new Set([
  "medical-research",
  "prediabetes",
  "insulin-resistance",
  "lifestyle",
]);

const tagLabels = {
  "medical-research": "医学研究",
  prediabetes: "糖尿病前期",
  "insulin-resistance": "胰岛素抵抗",
  lifestyle: "生活方式",
};

const sourceFallback = "国际医学期刊";

const todayIso = () => new Date().toISOString().slice(0, 10);

const clampFutureDate = (value) => {
  const date = (value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return todayIso();
  }

  return date > todayIso() ? todayIso() : date;
};

const frontmatterValue = (frontmatter, key) =>
  (frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1] || "")
    .trim()
    .replace(/^["']|["']$/g, "");

const frontmatterArray = (frontmatter, key) => {
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

const frontmatterBool = (frontmatter, key) =>
  /^true$/i.test(frontmatterValue(frontmatter, key));

const parseMdx = (raw) => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  return {
    frontmatter: match?.[1] || "",
    content: match?.[2] || raw,
  };
};

const splitBilingualTitle = (title) => {
  const [zh, ...enParts] = title.split(" / ");

  return {
    titleZh: zh?.trim() || title,
    titleEn: enParts.join(" / ").trim() || title,
  };
};

const sectionBetweenAny = (content, starts, ends = []) => {
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

const sectionBetweenAnyWithHeadings = (content, starts, ends = []) => {
  const matches = starts
    .map((start) => ({ start, index: content.indexOf(start) }))
    .filter(({ index }) => index !== -1)
    .sort((a, b) => a.index - b.index);

  if (!matches[0]) {
    return "";
  }

  const bodyStart = matches[0].index;
  const endIndex = ends
    .map((end) => content.indexOf(end, bodyStart + matches[0].start.length))
    .filter((index) => index !== -1)
    .sort((a, b) => a - b)[0];

  return (
    typeof endIndex === "number"
      ? content.slice(bodyStart, endIndex)
      : content.slice(bodyStart)
  )
    .replace(/^>\s?.+$/gm, "")
    .trim();
};

const cleanSummary = (text) =>
  text
    .replace(/\s+/g, " ")
    .replace(/本文仅供科普参考，不构成医疗建议。/g, "")
    .trim();

const firstParagraph = (text, fallback) =>
  cleanSummary(
    text
      .split(/\n{2,}/)
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .find(Boolean) || fallback,
  );

const countCjk = (value) => (value.match(/[\u3400-\u9fff]/g) ?? []).length;

const countEnglishWords = (value) =>
  (value.match(/\b[A-Za-z][A-Za-z'-]*\b/g) ?? []).length;

const readerSectionLabels = [
  "先说结论",
  "为什么值得关注",
  "证据告诉我们什么",
  "应该怎样理解",
  "可以怎么做",
];

const normalizeReaderArticle = (value) =>
  value
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/研究背景/g, "为什么值得关注")
    .replace(/核心发现/g, "证据告诉我们什么")
    .replace(/你的解读与批判/g, "应该怎样理解")
    .replace(/临床\/商业启发/g, "可以怎么做")
    .replace(/A[.、．：:]\s*给糖前读者的行动建议/g, "给糖前读者")
    .replace(/B[.、．：:]\s*给健康科技行业的启发/g, "给健康科技行业")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const readerSection = (content, label) => {
  const start = content.indexOf(label);
  if (start < 0) return "";
  const after = content.slice(start + label.length);
  const nextIndexes = readerSectionLabels
    .filter((next) => next !== label)
    .map((next) => after.indexOf(next))
    .filter((index) => index >= 0);
  const end = nextIndexes.length > 0 ? Math.min(...nextIndexes) : after.length;
  return after.slice(0, end).trim();
};

const evaluateReaderSopQuality = (rawBodyZh, bodyEn) => {
  const bodyZh = normalizeReaderArticle(rawBodyZh);
  const issues = [];

  readerSectionLabels.forEach((label) => {
    if (!bodyZh.includes(label))
      issues.push(`Missing required section: ${label}`);
  });

  const background = readerSection(bodyZh, "为什么值得关注");
  const finding = readerSection(bodyZh, "证据告诉我们什么");
  const critique = readerSection(bodyZh, "应该怎样理解");
  const insight = readerSection(bodyZh, "可以怎么做");

  if (countCjk(bodyZh) < 1800)
    issues.push(
      "Chinese SOP article is too short; it needs at least 1800 Chinese characters.",
    );
  if (countCjk(background) < 80)
    issues.push("Why-this-matters section is too short.");
  if (countCjk(finding) < 120)
    issues.push("Evidence section is too short or too vague.");
  if (countCjk(critique) < 650)
    issues.push("Meaning and limitations section is too short.");
  if (countCjk(insight) < 350) issues.push("Action section is too short.");
  if (!/给糖前读者/.test(insight))
    issues.push("Reader action subsection is missing.");
  if (!/给健康科技行业/.test(insight))
    issues.push("Health-tech insight subsection is missing.");
  if (/^\s*#{1,6}\s+/m.test(rawBodyZh))
    issues.push("Article contains visible Markdown heading markers.");
  if (/你的解读与批判|临床\/商业启发/.test(rawBodyZh))
    issues.push("Article contains internal editorial labels.");
  if (/^[-*]\s*$/m.test(bodyZh))
    issues.push("Article contains empty bullet points.");
  if (/治愈|保证逆转|必然逆转|替代医生/.test(bodyZh))
    issues.push("Article contains overclaimed medical language.");

  const englishWords = countEnglishWords(bodyEn);
  if (englishWords < 80)
    issues.push("English plain-language version is too short.");
  if (englishWords > 500)
    issues.push("English plain-language version is too long.");
  return issues;
};

const metadataLine = (content, label) =>
  content.match(new RegExp(`^- ${label}:\\s*(.+)$`, "im"))?.[1]?.trim();

const markdownLinkUrl = (value) =>
  value?.match(/\((https?:\/\/[^)]+)\)/)?.[1] ||
  value?.match(/https?:\/\/\S+/)?.[0]?.replace(/[.)]+$/, "");

const firstMetadataLink = (content, labels) =>
  labels
    .map((label) => metadataLine(content, label))
    .map(markdownLinkUrl)
    .find(Boolean);

const inferDoi = (content) =>
  content.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i)?.[0];

const inferCategoryLabels = (text, tags) => {
  const labels = new Set();
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
    const label = tagLabels[tag];

    if (label) {
      labels.add(label);
    }
  });

  return Array.from(labels).slice(0, 4);
};

const isResearchArticle = (tags) => tags.some((tag) => researchTags.has(tag));

const readArticle = (slug) => {
  const filePath = path.join(contentRoot, slug, "en.mdx");

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
  const bodyZhForQuality = sectionBetweenAnyWithHeadings(
    content,
    ["## 原文精华摘要", "## 中文白话版", "## 中文白话全文"],
    ["## English Plain-Language Version", "## Plain-English Version"],
  );
  const publishedAt = clampFutureDate(
    frontmatterValue(frontmatter, "publishedAt") || todayIso(),
  );
  const textForLabels = `${title} ${description} ${bodyZh} ${bodyEn}`;
  const draft = frontmatterBool(frontmatter, "draft");
  const manualOverride = frontmatterBool(frontmatter, "manualOverride");
  const frontmatterReviewRequired = frontmatterBool(
    frontmatter,
    "reviewRequired",
  );
  const qualityIssues = Array.from(
    new Set([
      ...frontmatterArray(frontmatter, "qualityIssues"),
      ...evaluateReaderSopQuality(bodyZhForQuality || bodyZh, bodyEn),
    ]),
  );
  const reviewRequired =
    draft &&
    !manualOverride &&
    (frontmatterReviewRequired || qualityIssues.length > 0);

  return {
    slug,
    titleZh,
    titleEn,
    summaryZh: firstParagraph(bodyZh, description),
    summaryEn: firstParagraph(bodyEn, description),
    bodyZh: bodyZh || description,
    bodyEn: bodyEn || description,
    thumbnail: frontmatterValue(frontmatter, "thumbnail"),
    source: metadataLine(content, "Journal/source") || sourceFallback,
    doi: inferDoi(content),
    originalUrl: firstMetadataLink(content, [
      "Link",
      "PubMed",
      "Open-access link",
      "DOI",
    ]),
    publishedAt,
    publishedAtLabel: publishedAt,
    draft,
    reviewRequired,
    qualityStatus: reviewRequired
      ? "needs_revision"
      : frontmatterValue(frontmatter, "qualityStatus") || "ready",
    qualityIssues,
    contentPath: `packages/cms/src/collections/blog/content/${slug}/en.mdx`,
    tags,
    categoryLabels: inferCategoryLabels(textForLabels, tags),
  };
};

const articles = fs.existsSync(contentRoot)
  ? fs
      .readdirSync(contentRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readArticle(entry.name))
      .filter(Boolean)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  : [];

const output = `// This file is generated by scripts/glucolit_build_review_manifest.mjs.
// Do not edit by hand.

export type ReviewArticleManifestItem = {
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
  publishedAt: string;
  publishedAtLabel: string;
  draft: boolean;
  reviewRequired: boolean;
  qualityStatus: string;
  qualityIssues: string[];
  contentPath: string;
  tags: string[];
  categoryLabels: string[];
};

export const reviewArticlesManifest: ReviewArticleManifestItem[] = ${JSON.stringify(
  articles,
  null,
  2,
)};
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, "utf8");
console.log(
  `Generated ${path.relative(repoRoot, outputPath)} with ${articles.length} review articles.`,
);
