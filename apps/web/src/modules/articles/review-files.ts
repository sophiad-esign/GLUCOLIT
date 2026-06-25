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

const readerSectionLabels = [
  "先说结论",
  "为什么值得关注",
  "证据告诉我们什么",
  "应该怎样理解",
  "可以怎么做",
];

const normalizeReaderArticle = (value: string) =>
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

const readerSection = (content: string, label: string) => {
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

const evaluateSopQuality = (bodyZh: string, bodyEn: string) => {
  bodyZh = normalizeReaderArticle(bodyZh);
  const issues: string[] = [];
  const requiredHeadings = readerSectionLabels;

  requiredHeadings.forEach((heading) => {
    if (!bodyZh.includes(heading)) {
      issues.push(`Missing required section: ${heading}`);
    }
  });

  const background = readerSection(bodyZh, "为什么值得关注");
  const finding = readerSection(bodyZh, "证据告诉我们什么");
  const critique = readerSection(bodyZh, "应该怎样理解");
  const insight = readerSection(bodyZh, "可以怎么做");

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
  if (countCjk(background) < 80) {
    issues.push("Research background is too short.");
  }
  if (countCjk(finding) < 120) {
    issues.push("Core findings are too short or too vague.");
  }
  if (countCjk(critique) < 650) {
    issues.push("Chinese interpretation and critique section is short.");
  }
  if (countCjk(insight) < 350) {
    issues.push("Chinese clinical/business insight section is short.");
  }
  if (!/给糖前读者/.test(insight)) {
    issues.push("Clinical action subsection A is missing.");
  }
  if (!/给健康科技行业/.test(insight)) {
    issues.push("Business insight subsection B is missing.");
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
