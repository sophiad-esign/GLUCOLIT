import { reviewArticlesManifest } from "./review-manifest.generated";

import type { Article } from "./data";

type ReviewRecord = {
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

const CONTENT_ROOT = "packages/cms/src/collections/blog/content";

const todayIso = () => new Date().toISOString().slice(0, 10);

export const clampFutureDate = (value?: string) => {
  const date = (value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return todayIso();
  }

  return date > todayIso() ? todayIso() : date;
};

const toArticle = (item: ReviewRecord): Article => {
  const publishedAtLabel = clampFutureDate(item.publishedAt);

  return {
    ...item,
    publishedAt: new Date(`${publishedAtLabel}T00:00:00.000Z`),
    publishedAtLabel,
    authors: "GLUCOLIT",
    referenceTitle: item.titleEn || item.titleZh,
    referenceLinks: [
      ...(item.doi
        ? [{ label: "DOI", href: `https://doi.org/${item.doi}` }]
        : []),
      ...(item.originalUrl
        ? [{ label: "Source", href: item.originalUrl }]
        : []),
    ],
    evidenceLabel: item.tags.includes("medical-research")
      ? "Research"
      : "Guide",
    reviewStatusLabel: item.reviewRequired ? "Needs revision" : "Ready",
  };
};

export const getReviewArticlesFromFiles = () =>
  (reviewArticlesManifest as ReviewRecord[])
    .map(toArticle)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

export const getReviewArticleFromFileBySlug = (slug: string) =>
  getReviewArticlesFromFiles().find((article) => article.slug === slug) ?? null;

const githubWriteToken = () =>
  process.env["GITHUB_CONTENT_TOKEN"] || process.env["GITHUB_TOKEN"];

const githubRepoIdentity = () => ({
  repoOwner: process.env["GITHUB_REPOSITORY_OWNER"] || "sophiad-esign",
  repoName: process.env["GITHUB_REPOSITORY"]?.split("/")[1] || "GLUCOLIT",
  repoBranch: process.env["GITHUB_CONTENT_BRANCH"] || "main",
});

const githubHeaders = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
});

const decodeBase64 = (value: string) =>
  Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");

const parseMdx = (raw: string) => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  return {
    frontmatter: match?.[1] ?? "",
    content: match ? raw.slice(match[0].length) : raw,
  };
};

const frontmatterValue = (frontmatter: string, key: string) => {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));

  return match?.[1]?.replace(/^["']|["']$/g, "").trim() ?? "";
};

const frontmatterBool = (frontmatter: string, key: string) =>
  /^true$/i.test(frontmatterValue(frontmatter, key));

const frontmatterArray = (frontmatter: string, key: string) => {
  const inline = frontmatter.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, "m"));

  if (inline) {
    return (inline[1] ?? "")
      .split(",")
      .map((item) => item.replace(/^["'\s]+|["'\s]+$/g, ""))
      .filter(Boolean);
  }

  const block = frontmatter.match(
    new RegExp(`^${key}:\\s*\\r?\\n((?:\\s+-\\s+.*\\r?\\n?)+)`, "m"),
  );

  return block
    ? (block[1] ?? "")
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    : [];
};

const metadataLine = (content: string, label: string) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^-\\s*${escaped}:\\s*(.*)$`, "im"));

  return match?.[1]?.trim() ?? "";
};

const sectionBetweenAny = (
  content: string,
  starts: string[],
  ends: string[],
) => {
  const startMatch = starts
    .map((heading) => ({ heading, index: content.indexOf(heading) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index)[0];

  if (!startMatch) {
    return "";
  }

  const after = content.slice(startMatch.index + startMatch.heading.length);
  const endIndexes = ends
    .map((heading) => after.indexOf(heading))
    .filter((index) => index >= 0);
  const end = endIndexes.length > 0 ? Math.min(...endIndexes) : after.length;

  return after.slice(0, end).trim();
};

const splitBilingualTitle = (title: string) => {
  const [titleZh, ...rest] = title.split(" / ");

  return {
    titleZh: titleZh?.trim() || title,
    titleEn: rest.join(" / ").trim(),
  };
};

const cleanPreviewText = (text: string) =>
  text
    .replace(/^#+\s+/gm, "")
    .replace(/^>\s?.+$/gm, "")
    .replace(/\s+/g, " ")
    .trim();

const firstParagraph = (body: string, fallback: string) =>
  cleanPreviewText(body || fallback)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find(Boolean) || fallback;

const countCjk = (value: string) =>
  (value.match(/[\u3400-\u9fff]/g) ?? []).length;

const countEnglishWords = (value: string) =>
  (value.match(/\b[A-Za-z][A-Za-z'-]*\b/g) ?? []).length;

const countReadableParagraphs = (value: string) =>
  value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => countCjk(part) >= 35).length;

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

const normalizeReaderArticle = (value: string) =>
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

const hasEvidenceSignals = (value: string) =>
  /(\u7814\u7a76|\u4eba\u7fa4|\u6837\u672c|\u6570\u636e|\u7ed3\u679c|\u98ce\u9669|\u89c2\u5bdf|\u5206\u6790|\u961f\u5217|\u8bd5\u9a8c|\u5bf9\u7167|\u6307\u6807|\u6548\u5e94|\u53d1\u73b0|P\u503c|\u7f6e\u4fe1\u533a\u95f4|\u6458\u8981|PubMed|DOI)/i.test(
    value,
  );

const hasBoundarySignals = (value: string) =>
  /(\u4e0d\u80fd\u8bc1\u660e|\u4e0d\u80fd\u8bf4\u660e|\u76f8\u5173\u4e0d\u7b49\u4e8e\u56e0\u679c|\u76f8\u5173|\u56e0\u679c|\u5c40\u9650|\u9650\u5236|\u4e0d\u4ee3\u8868|\u4ecd\u9700\u8981|\u53ef\u80fd|\u9002\u7528|\u4e0d\u80fd\u66ff\u4ee3|\u5c1a\u672a\u8bc1\u660e|\u89c2\u5bdf\u6027\u7814\u7a76|\u6837\u672c)/.test(
    value,
  );

const hasActionSignals = (value: string) =>
  /(\u5efa\u8bae|\u53ef\u4ee5|\u4f18\u5148|\u8bb0\u5f55|\u76d1\u6d4b|\u590d\u67e5|\u54a8\u8be2|\u8fd0\u52a8|\u996e\u98df|\u7761\u7720|\u4f53\u91cd|OGTT|HbA1c|\u8170\u56f4|\u9910\u540e|\u533b\u751f|\u6b65\u884c|\u529b\u91cf|\u86cb\u767d)/i.test(
    value,
  );

const hasIndustrySignals = (value: string) =>
  /(\u4ea7\u54c1|\u5de5\u5177|\u7528\u6237|\u98ce\u9669\u5206\u5c42|\u4e2a\u6027\u5316|APP|\u5e94\u7528|CGM|\u76d1\u6d4b|\u6570\u636e|\u53cd\u9988|\u4f9d\u4ece|\u670d\u52a1|\u573a\u666f|\u6d41\u7a0b|\u5546\u4e1a|\u5065\u5eb7\u79d1\u6280)/i.test(
    value,
  );

const evaluateSopQuality = (bodyZh: string, bodyEn: string) => {
  bodyZh = normalizeReaderArticle(bodyZh);
  const issues: string[] = [];

  if (countCjk(bodyZh) < 1800) {
    issues.push(
      "Chinese SOP article is too short; it needs at least 1800 Chinese characters.",
    );
  }
  if (countReadableParagraphs(bodyZh) < 12) {
    issues.push(
      "Chinese SOP article needs at least 12 short readable paragraphs.",
    );
  }
  if (!hasEvidenceSignals(bodyZh)) {
    issues.push("Chinese article does not clearly explain the evidence.");
  }
  if (!hasBoundarySignals(bodyZh)) {
    issues.push("Chinese article does not clearly explain evidence limits.");
  }
  if (!hasActionSignals(bodyZh)) {
    issues.push("Chinese article lacks practical reader-facing actions.");
  }
  if (!hasIndustrySignals(bodyZh)) {
    issues.push("Chinese article lacks health-tech or system insight.");
  }
  forbiddenPublicPhrases.forEach((phrase) => {
    if (bodyZh.includes(phrase)) {
      issues.push("Article exposes internal SOP label: " + phrase);
    }
  });
  if (/^\s*#{1,6}\s+/m.test(bodyZh)) {
    issues.push("Article contains visible Markdown heading markers.");
  }
  if (countEnglishWords(bodyEn) < 80) {
    issues.push("English plain-language version is too short.");
  }
  if (countEnglishWords(bodyEn) > 240) {
    issues.push("English plain-language version is too long.");
  }
  if (
    /Original title:|Authors:|Journal\/source:|PubMed\/source link:|Evidence used:/i.test(
      bodyZh,
    )
  ) {
    issues.push("Metadata is still mixed into the Chinese article body.");
  }
  if (/^[-*]\s*$/m.test(bodyZh)) {
    issues.push("Article contains empty bullet points.");
  }
  if (
    /(\u6cbb\u6108|\u6839\u6cbb|\u9006\u8f6c\u7cd6\u5c3f\u75c5|\u4fdd\u8bc1|\u767e\u5206\u767e)/.test(
      bodyZh,
    )
  ) {
    issues.push("Article contains overclaimed medical language.");
  }

  return issues;
};

const firstMetadataLink = (content: string, labels: string[]) => {
  for (const label of labels) {
    const value = metadataLine(content, label);
    const link = value.match(/\((https?:\/\/[^)]+)\)/)?.[1];

    if (link) {
      return link;
    }

    if (/^https?:\/\//.test(value)) {
      return value;
    }
  }

  return undefined;
};

const inferDoi = (content: string) => {
  const value = metadataLine(content, "DOI") || content;

  return (
    value.match(/10\.\d{4,9}\/[^\s)\]]+/)?.[0]?.replace(/[.,;]+$/, "") ?? ""
  );
};

const categoryLabelsFromTags = (tags: string[]) => {
  const labels: Record<string, string> = {
    "medical-research": "Research",
    prediabetes: "Prediabetes",
    lifestyle: "Lifestyle",
    "insulin-resistance": "Insulin resistance",
    cgm: "CGM",
  };

  return tags.map((tag) => labels[tag] ?? tag).slice(0, 4);
};

const headings = {
  essence: "\u539f\u6587\u7cbe\u534e\u6458\u8981",
  oldPlainZh: "\u4e2d\u6587\u767d\u8bdd\u7248",
  englishPlain: "English Plain-Language Version",
  plainEnglish: "Plain-English Version",
  source: "Source",
  researchPrimer: "Research Primer",
  originalFiles: "\u539f\u6587\u4e0e\u6587\u4ef6",
  interpretation: "\u89e3\u8bfb\u4e0e\u6279\u5224",
};

const readLiveArticle = (slug: string, raw: string): ReviewRecord | null => {
  const { content, frontmatter } = parseMdx(raw);
  const tags = frontmatterArray(frontmatter, "tags");

  if (!tags.includes("medical-research")) {
    return null;
  }

  const title = frontmatterValue(frontmatter, "title");
  const description = frontmatterValue(frontmatter, "description");
  const { titleEn, titleZh } = splitBilingualTitle(title);
  const bodyZh = sectionBetweenAny(
    content,
    [`## ${headings.essence}`, `## ${headings.oldPlainZh}`],
    [`## ${headings.englishPlain}`, `## ${headings.plainEnglish}`],
  );
  const bodyEn = sectionBetweenAny(
    content,
    [`## ${headings.englishPlain}`, `## ${headings.plainEnglish}`],
    [
      `## ${headings.source}`,
      `## ${headings.researchPrimer}`,
      `## ${headings.originalFiles}`,
      `## ${headings.interpretation}`,
    ],
  );
  const publishedAt = clampFutureDate(
    frontmatterValue(frontmatter, "publishedAt") || todayIso(),
  );
  const draft = frontmatterBool(frontmatter, "draft");
  const manualOverride = frontmatterBool(frontmatter, "manualOverride");
  const frontmatterReviewRequired = frontmatterBool(
    frontmatter,
    "reviewRequired",
  );
  const qualityIssues = Array.from(
    new Set([
      ...frontmatterArray(frontmatter, "qualityIssues"),
      ...evaluateSopQuality(bodyZh, bodyEn),
    ]),
  );
  const computedReviewRequired =
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
    source: metadataLine(content, "Journal/source") || "PubMed",
    doi: inferDoi(content),
    originalUrl: firstMetadataLink(content, [
      "Link",
      "PubMed",
      "PubMed/source link",
      "Open-access link",
      "DOI",
    ]),
    publishedAt,
    publishedAtLabel: publishedAt,
    draft,
    reviewRequired: computedReviewRequired,
    qualityStatus: computedReviewRequired
      ? "needs_revision"
      : frontmatterValue(frontmatter, "qualityStatus") || "ready",
    qualityIssues,
    topic: frontmatterValue(frontmatter, "topic") || undefined,
    contentPath: `${CONTENT_ROOT}/${slug}/en.mdx`,
    tags,
    categoryLabels: categoryLabelsFromTags(tags),
  };
};

const getReviewArticlesFromGithub = async () => {
  const token = githubWriteToken();

  if (!token) {
    return [];
  }

  const { repoBranch, repoName, repoOwner } = githubRepoIdentity();
  const apiRoot = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${CONTENT_ROOT}`;
  const directoryResponse = await fetch(`${apiRoot}?ref=${repoBranch}`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });

  if (!directoryResponse.ok) {
    return [];
  }

  const entries = (await directoryResponse.json()) as {
    name: string;
    type: string;
  }[];
  const articles = await Promise.all(
    entries
      .filter((entry) => entry.type === "dir")
      .map(async (entry) => {
        const fileResponse = await fetch(
          `${apiRoot}/${entry.name}/en.mdx?ref=${repoBranch}`,
          {
            headers: githubHeaders(token),
            cache: "no-store",
          },
        );

        if (!fileResponse.ok) {
          return null;
        }

        const file = (await fileResponse.json()) as { content?: string };

        return file.content
          ? readLiveArticle(entry.name, decodeBase64(file.content))
          : null;
      }),
  );

  return articles
    .filter((article): article is ReviewRecord => Boolean(article))
    .map(toArticle)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
};

const needsAdminReview = (article: Article) =>
  article.draft ||
  article.reviewRequired ||
  article.qualityStatus === "needs_revision";

export const getAdminReviewArticles = async () => {
  const liveArticles = await getReviewArticlesFromGithub();

  const source =
    liveArticles.length > 0 ? liveArticles : getReviewArticlesFromFiles();

  return source.filter(needsAdminReview);
};

export const getAdminReviewArticleBySlug = async (slug: string) =>
  (await getAdminReviewArticles()).find((article) => article.slug === slug) ??
  null;
