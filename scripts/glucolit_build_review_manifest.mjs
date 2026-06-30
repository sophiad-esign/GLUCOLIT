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

const forbiddenPublicPhrases = [
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
];

const normalizeReaderArticle = (value) =>
  value
    .replace(/^#{1,6}\s*/gm, "")
    .replace(
      /^(\u7814\u7a76\u80cc\u666f|\u6838\u5fc3\u53d1\u73b0|\u4f60\u7684\u6279\u5224\u4e0e\u89e3\u8bfb|\u4f60\u7684\u89e3\u8bfb\u4e0e\u6279\u5224|\u4e34\u5e8a\/\u5546\u4e1a\u542f\u53d1)\s*[:\uff1a]?/gm,
      "",
    )
    .replace(
      /^(\u5148\u8bf4\u7ed3\u8bba|\u4e3a\u4ec0\u4e48\u503c\u5f97\u5173\u6ce8|\u8bc1\u636e\u544a\u8bc9\u6211\u4eec\u4ec0\u4e48|\u5e94\u8be5\u600e\u6837\u7406\u89e3|\u53ef\u4ee5\u600e\u4e48\u505a)\s*[:\uff1a]?/gm,
      "",
    )
    .replace(
      /^A[.\u3001\uff0e\uff1a:]\s*\u7ed9\u7cd6\u524d\u8bfb\u8005\u7684\u884c\u52a8\u5efa\u8bae\s*[:\uff1a]?/gm,
      "",
    )
    .replace(
      /^B[.\u3001\uff0e\uff1a:]\s*\u7ed9\u5065\u5eb7\u79d1\u6280\u884c\u4e1a\u7684\u542f\u53d1\s*[:\uff1a]?/gm,
      "",
    )
    .replace(/^\u7ed9\u7cd6\u524d\u8bfb\u8005\s*[:\uff1a]?/gm, "")
    .replace(/^\u7ed9\u5065\u5eb7\u79d1\u6280\u884c\u4e1a\s*[:\uff1a]?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const countReadableParagraphs = (value) =>
  value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => countCjk(part) >= 35).length;

const hasEvidenceSignals = (value) =>
  /(\u7814\u7a76|\u4eba\u7fa4|\u6837\u672c|\u6570\u636e|\u7ed3\u679c|\u98ce\u9669|\u89c2\u5bdf|\u5206\u6790|\u961f\u5217|\u8bd5\u9a8c|\u5bf9\u7167|\u6307\u6807|\u6548\u5e94|\u53d1\u73b0|P\u503c|\u7f6e\u4fe1\u533a\u95f4|\u6458\u8981|PubMed|DOI)/i.test(
    value,
  );

const hasBoundarySignals = (value) =>
  /(\u4e0d\u80fd\u8bc1\u660e|\u4e0d\u80fd\u8bf4\u660e|\u76f8\u5173\u4e0d\u7b49\u4e8e\u56e0\u679c|\u76f8\u5173|\u56e0\u679c|\u5c40\u9650|\u9650\u5236|\u4e0d\u4ee3\u8868|\u4ecd\u9700\u8981|\u53ef\u80fd|\u9002\u7528|\u4e0d\u80fd\u66ff\u4ee3|\u5c1a\u672a\u8bc1\u660e|\u89c2\u5bdf\u6027\u7814\u7a76|\u6837\u672c)/.test(
    value,
  );

const hasActionSignals = (value) =>
  /(\u5efa\u8bae|\u53ef\u4ee5|\u4f18\u5148|\u8bb0\u5f55|\u76d1\u6d4b|\u590d\u67e5|\u54a8\u8be2|\u8fd0\u52a8|\u996e\u98df|\u7761\u7720|\u4f53\u91cd|OGTT|HbA1c|\u8170\u56f4|\u9910\u540e|\u533b\u751f|\u6b65\u884c|\u529b\u91cf|\u86cb\u767d)/i.test(
    value,
  );

const hasIndustrySignals = (value) =>
  /(\u4ea7\u54c1|\u5de5\u5177|\u7528\u6237|\u98ce\u9669\u5206\u5c42|\u4e2a\u6027\u5316|APP|\u5e94\u7528|CGM|\u76d1\u6d4b|\u6570\u636e|\u53cd\u9988|\u4f9d\u4ece|\u670d\u52a1|\u573a\u666f|\u6d41\u7a0b|\u5546\u4e1a|\u5065\u5eb7\u79d1\u6280)/i.test(
    value,
  );

const evaluateReaderSopQuality = (rawBodyZh, bodyEn) => {
  const bodyZh = normalizeReaderArticle(rawBodyZh);
  const issues = [];

  if (countCjk(bodyZh) < 1800)
    issues.push(
      "Chinese SOP article is too short; it needs at least 1800 Chinese characters.",
    );
  if (countReadableParagraphs(bodyZh) < 12)
    issues.push(
      "Chinese SOP article needs at least 12 short readable paragraphs.",
    );
  if (!hasEvidenceSignals(bodyZh))
    issues.push("Chinese article does not clearly explain the evidence.");
  if (!hasBoundarySignals(bodyZh))
    issues.push("Chinese article does not clearly explain evidence limits.");
  if (!hasActionSignals(bodyZh))
    issues.push("Chinese article lacks practical reader-facing actions.");
  if (!hasIndustrySignals(bodyZh))
    issues.push("Chinese article lacks health-tech or system insight.");
  forbiddenPublicPhrases.forEach((phrase) => {
    if (bodyZh.includes(phrase))
      issues.push("Article exposes internal SOP label: " + phrase);
  });
  if (/^\s*#{1,6}\s+/m.test(rawBodyZh))
    issues.push("Article contains visible Markdown heading markers.");
  if (/^[-*]\s*$/m.test(bodyZh))
    issues.push("Article contains empty bullet points.");
  if (
    /(\u6cbb\u6108|\u6839\u6cbb|\u9006\u8f6c\u7cd6\u5c3f\u75c5|\u4fdd\u8bc1|\u767e\u5206\u767e)/.test(
      bodyZh,
    )
  )
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
    topic: frontmatterValue(frontmatter, "topic") || undefined,
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
  topic?: string;
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
