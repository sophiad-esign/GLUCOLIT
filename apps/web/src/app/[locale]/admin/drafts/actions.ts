"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { pathsConfig } from "~/config/paths";

const CONTENT_ROOT = "packages/cms/src/collections/blog/content/";
const PUBLISH_WORKFLOW_FILE = "publish-web.yml";
const REVISION_SYSTEM_PROMPT =
  "You are a senior bilingual medical science editor for GLUCOLIT. Write reader-facing Chinese health journalism, not academic translation. Return only valid JSON.";

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
};

type RevisedArticle = {
  bodyEn: string;
  bodyZh: string;
  descriptionEn?: string;
  descriptionZh?: string;
  takeawaysEn?: string[];
  takeawaysZh?: string[];
  titleEn?: string;
  titleZh?: string;
};

type QualityEvaluation = {
  issues: string[];
  ready: boolean;
};

const envValue = (name: string) => process.env[name];

const redirectWithError = (message: string): never => {
  redirect(
    `${pathsConfig.admin.drafts.index}?error=${encodeURIComponent(message)}`,
  );
};

const assertContentPath = (path: string) => {
  if (
    !path.startsWith(CONTENT_ROOT) ||
    !path.endsWith("/en.mdx") ||
    path.includes("..")
  ) {
    redirectWithError("Unsafe article path. Publish was blocked.");
  }
};

const decodeBase64 = (value: string) =>
  Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");

const encodeBase64 = (value: string) =>
  Buffer.from(value, "utf8").toString("base64");

const getFormString = (formData: FormData, key: string) => {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
};

const githubWriteToken = () =>
  envValue("GITHUB_CONTENT_TOKEN") || envValue("GITHUB_TOKEN");

const requireGithubWriteToken = (): string => {
  const token = githubWriteToken();

  if (!token) {
    redirectWithError(
      "Missing Vercel env var GITHUB_CONTENT_TOKEN. Cannot write to GitHub.",
    );
    throw new Error("Missing GitHub write token.");
  }

  return token;
};

const githubConfig = (token: string, contentPath: string) => {
  const repoOwner = envValue("GITHUB_REPOSITORY_OWNER") || "sophiad-esign";
  const repoName = envValue("GITHUB_REPOSITORY")?.split("/")[1] || "GLUCOLIT";
  const repoBranch = envValue("GITHUB_CONTENT_BRANCH") || "main";

  return {
    apiUrl: `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${contentPath}`,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    repoBranch,
  };
};

const githubRepoIdentity = () => ({
  repoOwner: envValue("GITHUB_REPOSITORY_OWNER") || "sophiad-esign",
  repoName: envValue("GITHUB_REPOSITORY")?.split("/")[1] || "GLUCOLIT",
  repoBranch: envValue("GITHUB_CONTENT_BRANCH") || "main",
});

const triggerPublishWorkflow = async (token: string) => {
  const { repoBranch, repoName, repoOwner } = githubRepoIdentity();
  const response = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${PUBLISH_WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: repoBranch }),
    },
  );

  return response.ok;
};

const revalidateAdminDrafts = (slug?: string) => {
  revalidatePath(pathsConfig.admin.drafts.index);

  if (slug) {
    revalidatePath(pathsConfig.admin.drafts.draft(slug));
  }
};

const readGithubFile = async (contentPath: string, token: string) => {
  const { apiUrl, headers, repoBranch } = githubConfig(token, contentPath);
  const currentResponse = await fetch(`${apiUrl}?ref=${repoBranch}`, {
    headers,
    cache: "no-store",
  });

  if (!currentResponse.ok) {
    redirectWithError(`Failed to read GitHub file: ${currentResponse.status}`);
  }

  const current = (await currentResponse.json()) as {
    content?: string;
    sha?: string;
  };
  const currentContent = current.content ?? "";
  const currentSha = current.sha ?? "";

  if (!currentContent || !currentSha) {
    redirectWithError("GitHub returned an incomplete file response.");
  }

  return {
    apiUrl,
    headers,
    repoBranch,
    raw: decodeBase64(currentContent),
    sha: currentSha,
  };
};

const writeGithubFile = async ({
  apiUrl,
  branch,
  content,
  headers,
  message,
  sha,
}: {
  apiUrl: string;
  branch: string;
  content: string;
  headers: Record<string, string>;
  message: string;
  sha: string;
}) => {
  const putFile = (fileSha: string) =>
    fetch(apiUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: encodeBase64(content),
        sha: fileSha,
        branch,
      }),
    });

  let updateResponse = await putFile(sha);

  if (updateResponse.status === 409) {
    const latestResponse = await fetch(`${apiUrl}?ref=${branch}`, {
      headers,
      cache: "no-store",
    });

    if (!latestResponse.ok) {
      const details = await latestResponse.text();
      redirectWithError(
        `GitHub file changed during write, and the latest file could not be reloaded: ${latestResponse.status} ${details}`,
      );
    }

    const latest = (await latestResponse.json()) as { sha?: string };
    const latestSha = latest.sha ?? "";

    if (!latestSha) {
      redirectWithError(
        "GitHub file changed during write, and GitHub returned no latest file SHA.",
      );
    }

    updateResponse = await putFile(latestSha);
  }

  if (!updateResponse.ok) {
    const details = await updateResponse.text();
    redirectWithError(
      `Failed to write GitHub file: ${updateResponse.status} ${details}`,
    );
  }
};

const frontmatterValue = (raw: string, key: string) => {
  const match = raw.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));

  return match?.[1]?.replace(/^["']|["']$/g, "").trim() ?? "";
};

const metadataLine = (raw: string, label: string) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = raw.match(new RegExp(`^-\\s*${escaped}:\\s*(.*)$`, "im"));

  return match?.[1]?.trim() ?? "";
};

const sectionText = (raw: string, heading: string, nextHeadings: string[]) => {
  const start = raw.indexOf(heading);
  if (start < 0) {
    return "";
  }

  const after = raw.slice(start + heading.length);
  const nextIndexes = nextHeadings
    .map((next) => after.indexOf(next))
    .filter((index) => index >= 0);
  const end = nextIndexes.length > 0 ? Math.min(...nextIndexes) : after.length;

  return after.slice(0, end).trim();
};

const stripFrontmatter = (raw: string) =>
  raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

const cleanMarkdown = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*[-*]\s*$/gm, "")
    .trim();

const frontmatterWithoutQualityIssues = (frontmatter: string) =>
  frontmatter
    .replace(/^reviewRequired:\s*(true|false)\s*$/m, "")
    .replace(/^qualityStatus:\s*.*$/m, "")
    .replace(/^qualityIssues:\s*\[[^\n]*\]\r?\n?/m, "")
    .replace(/^qualityIssues:\s*\r?\n(?:\s+-\s+.*\r?\n?)+/m, "");

const yamlStringList = (items: string[]) =>
  `[${items.map((item) => JSON.stringify(item)).join(", ")}]`;

const withQualityFrontmatter = (
  frontmatter: string,
  evaluation: QualityEvaluation,
) => {
  const base = frontmatterWithoutQualityIssues(frontmatter).trimEnd();

  return [
    base,
    `reviewRequired: ${evaluation.ready ? "false" : "true"}`,
    `qualityStatus: ${evaluation.ready ? "ready" : "needs_revision"}`,
    evaluation.issues.length > 0
      ? `qualityIssues: ${yamlStringList(evaluation.issues)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const replaceFrontmatterValue = (
  frontmatter: string,
  key: string,
  value: string,
) => {
  const escaped = value.replace(/"/g, '\\"');
  const line = `${key}: "${escaped}"`;

  return new RegExp(`^${key}:.*$`, "m").test(frontmatter)
    ? frontmatter.replace(new RegExp(`^${key}:.*$`, "m"), line)
    : `${frontmatter.trimEnd()}\n${line}`;
};

const replaceRawFrontmatterLiteral = (
  raw: string,
  key: string,
  value: string,
) => {
  const line = `${key}: ${value}`;

  return new RegExp(`^${key}:.*$`, "m").test(raw)
    ? raw.replace(new RegExp(`^${key}:.*$`, "m"), line)
    : raw.replace(/^---\r?\n/, `---\n${line}\n`);
};

const removeRawQualityIssues = (raw: string) =>
  raw
    .replace(/^qualityIssues:\s*\[[^\n]*\]\r?\n?/m, "")
    .replace(/^qualityIssues:\s*\r?\n(?:\s+-\s+.*\r?\n?)+/m, "");

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

const evaluateRevisedArticle = (revised: RevisedArticle): QualityEvaluation => {
  const rawBodyZh = cleanMarkdown(revised.bodyZh ?? "");
  const bodyZh = normalizeReaderArticle(rawBodyZh);
  const bodyEn = cleanMarkdown(revised.bodyEn ?? "");
  const issues: string[] = [];
  const paragraphCount = countReadableParagraphs(bodyZh);
  const evidenceSignals =
    /(\u7814\u7a76|\u6570\u636e|\u6837\u672c|\u968f\u8bbf|\u961f\u5217|\u968f\u673a|\u89c2\u5bdf|\u7cfb\u7edf\u56de\u987e|\u8363\u8403|\u98ce\u9669|\u7ed3\u679c|\u53d1\u73b0|PubMed|DOI)/i.test(
      bodyZh,
    );
  const boundarySignals =
    /(\u4e0d\u80fd\u8bc1\u660e|\u76f8\u5173|\u56e0\u679c|\u5c40\u9650|\u4e0d\u4ee3\u8868|\u4ecd\u9700|\u6837\u672c|\u5916\u63a8|\u89c2\u5bdf\u6027|\u4e0d\u9002\u7528|\u4e0d\u80fd\u7b49\u540c)/.test(
      bodyZh,
    );
  const actionSignals =
    /(\u5efa\u8bae|\u53ef\u4ee5|\u4f18\u5148|\u8bb0\u5f55|\u76d1\u6d4b|\u590d\u67e5|\u8fd0\u52a8|\u996e\u98df|\u7761\u7720|\u54a8\u8be2|\u533b\u751f|\u4f53\u68c0|CGM|OGTT|HbA1c)/i.test(
      bodyZh,
    );
  const insightSignals =
    /(\u5065\u5eb7\u79d1\u6280|\u4ea7\u54c1|\u5e73\u53f0|\u5de5\u5177|\u6570\u636e|\u98ce\u9669\u5206\u5c42|\u670d\u52a1|\u4f9d\u4ece\u6027|\u7ba1\u7406|\u7cfb\u7edf|CGM|\u5e94\u7528)/i.test(
      bodyZh,
    );

  if (countCjk(bodyZh) < 1800) {
    issues.push(
      "Chinese SOP article is too short; it needs at least 1800 Chinese characters.",
    );
  }
  if (paragraphCount < 12) {
    issues.push(
      "Chinese SOP article needs at least 12 short readable paragraphs.",
    );
  }
  if (!evidenceSignals) {
    issues.push("Evidence narrative is too thin or missing.");
  }
  if (!boundarySignals) {
    issues.push("Evidence limits and causality boundaries are missing.");
  }
  if (!actionSignals) {
    issues.push("Reader action guidance is missing.");
  }
  if (!insightSignals) {
    issues.push("Original GLUCOLIT system or health-tech insight is missing.");
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
  if (/^\s*#{1,6}\s+/m.test(rawBodyZh)) {
    issues.push("Article contains visible Markdown heading markers.");
  }
  forbiddenPublicPhrases.forEach((phrase) => {
    if (rawBodyZh.includes(phrase)) {
      issues.push("Article contains internal workflow label: " + phrase + ".");
    }
  });
  if (
    /(\u6cbb\u6108|\u6839\u6cbb|\u4fdd\u8bc1\u9006\u8f6c|\u5fc5\u7136\u9006\u8f6c|\u767e\u5206\u767e|\u66ff\u4ee3\u533b\u751f)/.test(
      bodyZh,
    )
  ) {
    issues.push("Article contains overclaimed medical language.");
  }
  const englishWords = countEnglishWords(bodyEn);
  if (englishWords < 80) {
    issues.push("English plain-language version is too short.");
  }
  if (englishWords > 240) {
    issues.push("English plain-language version is too long.");
  }

  return {
    issues,
    ready: issues.length === 0,
  };
};

const evaluateRawDraft = (raw: string): QualityEvaluation => {
  const bodyZh = sectionText(raw, "## \u539f\u6587\u7cbe\u534e\u6458\u8981", [
    "## English Plain-Language Version",
    "## Source",
    "## Research Primer",
  ]);
  const bodyEn = sectionText(raw, "## English Plain-Language Version", [
    "## Source",
    "## Research Primer",
  ]);

  return evaluateRevisedArticle({ bodyEn, bodyZh });
};

const revisionScore = (
  article: RevisedArticle,
  evaluation?: QualityEvaluation,
) =>
  countCjk(article.bodyZh ?? "") +
  countEnglishWords(article.bodyEn ?? "") * 2 -
  (evaluation?.issues.length ?? 0) * 300;

const buildRevisionAttemptRaw = (
  originalRaw: string,
  revised: RevisedArticle,
  evaluation: QualityEvaluation,
) =>
  [
    stripFrontmatter(originalRaw),
    "",
    "## Previous SOP revision attempt",
    "",
    "The previous attempt was still too thin. Continue from it, expand every weak part, and fix the listed issues. Do not restart with another short summary. The next answer must be substantially longer, more specific, and more useful.",
    "",
    "Failed checks: " + evaluation.issues.join("; "),
    "",
    "Previous Chinese body",
    "",
    revised.bodyZh,
    "",
    "Previous English body",
    "",
    revised.bodyEn,
  ].join("\n");

const buildSopRevisionPrompt = (raw: string, qualityFeedback?: string[]) => {
  const existingBody = stripFrontmatter(raw).slice(0, 12000);
  const originalTitle =
    metadataLine(raw, "Original title") || frontmatterValue(raw, "title");
  const authors = metadataLine(raw, "Authors");
  const source = metadataLine(raw, "Journal/source");
  const doi = metadataLine(raw, "DOI") || frontmatterValue(raw, "doi");
  const pubmed = metadataLine(raw, "PubMed/source link");
  const openAccess = metadataLine(raw, "Open-access link");
  const evidence = metadataLine(raw, "Evidence used");
  const date =
    metadataLine(raw, "Published or indexed date") ||
    frontmatterValue(raw, "publishedAt");
  const currentZh = sectionText(
    raw,
    "## \u539f\u6587\u7cbe\u534e\u6458\u8981",
    ["## English Plain-Language Version", "## Source"],
  );
  const currentEn = sectionText(raw, "## English Plain-Language Version", [
    "## Source",
    "## Research Primer",
  ]);
  const feedbackLines = qualityFeedback?.length
    ? [
        "The previous attempt failed these quality checks. Fix every item before returning JSON:",
        "- " + qualityFeedback.join("\n- "),
        "",
      ]
    : [];

  return [
    "Rewrite this GLUCOLIT draft into a publishable public science article. The current draft is too thin, too templated, or too close to metadata plus translation.",
    "",
    ...feedbackLines,
    "Hard rules:",
    "- Use only the supplied source metadata, abstract/commentary fragments, DOI/PubMed links, and existing draft text. Do not invent sample sizes, statistics, populations, interventions, or outcomes that are not present.",
    "- Do not scrape or imply access to paywalled full text.",
    "- Move all metadata into Research Primer. Do not put Original title, Authors, Journal/source, DOI, or PubMed/source link inside the Chinese body.",
    "- The Chinese body must read like a finished medical science column for ordinary readers, not a reviewer note and not a labeled outline.",
    "- Paragraphs must be short: usually 80-140 Chinese characters, with blank lines between paragraphs. No giant blocks. No empty bullets.",
    "- Keep uncertainty and causality boundaries clear. Do not say cure, reverse, guaranteed, or personalized treatment unless the source supports it.",
    "- The final Chinese body must be 1900-2600 Chinese characters and at least 12 short paragraphs.",
    "- Do not merely translate the abstract. Explain the reader problem, the evidence, the limits, and the practical meaning.",
    "- The output must look materially different from the input draft. Expand the analysis, split paragraphs, and add source-bounded explanation.",
    "- If the source does not provide exact numbers, say the source does not provide enough detail instead of inventing data.",
    "",
    "Best-practice public science article SOP. This architecture is invisible to readers and must not be printed as labels:",
    "1. Open with a real reader scene or decision that makes the research matter.",
    "2. Give the useful takeaway naturally in the first two paragraphs, without a label.",
    "3. Tell the evidence story: what question the paper asked, what population or data it used, and what direction the result points to.",
    "4. Translate the mechanism into everyday language so readers understand why the result may matter.",
    "5. Explain the boundary: association versus causation, sample limits, population limits, and what the paper cannot prove.",
    "6. Turn the finding into cautious, practical next steps for people with prediabetes or metabolic risk.",
    "7. Add a GLUCOLIT-style systems insight about measurement, adherence, risk stratification, product design, or care delivery.",
    "8. Close with 3-5 memorable reader notes written as natural prose or concise bullets.",
    "",
    "Never print these internal workflow labels inside bodyZh: " +
      forbiddenPublicPhrases.join(", ") +
      ".",
    "Never use visible Markdown heading markers inside bodyZh.",
    "",
    "English body:",
    "- 80-220 English words.",
    "- Plain language, same conclusion, no long detail.",
    "",
    "Return JSON only:",
    "{",
    '  "titleZh": "...",',
    '  "titleEn": "...",',
    '  "descriptionZh": "...",',
    '  "descriptionEn": "...",',
    '  "bodyZh": "Reader-facing Chinese article body without visible section labels or heading markers",',
    '  "bodyEn": "Plain English paragraphs",',
    '  "takeawaysZh": ["...", "...", "...", "..."],',
    '  "takeawaysEn": ["...", "...", "...", "..."]',
    "}",
    "",
    "Source metadata:",
    "Original title: " + originalTitle,
    "Authors: " + authors,
    "Journal/source: " + source,
    "DOI: " + doi,
    "PubMed/source link: " + pubmed,
    "Open-access link: " + openAccess,
    "Evidence used: " + evidence,
    "Published or indexed date: " + date,
    "",
    "Current Chinese fragment:",
    currentZh,
    "",
    "Current English fragment:",
    currentEn,
    "",
    "Full current draft excerpt:",
    existingBody,
  ]
    .join("\n")
    .trim();
};

const llmConfig = (): LlmConfig | null => {
  const kimiKey = envValue("KIMI_API_KEY");
  if (kimiKey) {
    return {
      apiKey: kimiKey,
      baseUrl: envValue("KIMI_BASE_URL") || "https://api.moonshot.ai/v1",
      model: envValue("KIMI_MODEL") || "moonshot-v1-32k",
      provider: "Kimi",
    };
  }

  const openAiKey = envValue("OPENAI_API_KEY");
  if (openAiKey) {
    return {
      apiKey: openAiKey,
      baseUrl: "https://api.openai.com/v1",
      model: envValue("OPENAI_MODEL") || "gpt-4o-mini",
      provider: "OpenAI",
    };
  }

  return null;
};

const requireLlmConfig = (): LlmConfig => {
  const config = llmConfig();

  if (!config) {
    redirectWithError(
      "Missing KIMI_API_KEY or OPENAI_API_KEY in Vercel env vars. Cannot run SOP revision.",
    );
    throw new Error("Missing LLM config.");
  }

  return config;
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const retryAfterMs = (response: Response, fallbackMs: number) => {
  const retryAfter = response.headers.get("retry-after");

  if (!retryAfter) {
    return fallbackMs;
  }

  const seconds = Number(retryAfter);

  if (Number.isFinite(seconds)) {
    return Math.max(seconds * 1000, fallbackMs);
  }

  const retryAt = Date.parse(retryAfter);

  if (Number.isFinite(retryAt)) {
    return Math.max(retryAt - Date.now(), fallbackMs);
  }

  return fallbackMs;
};

const isRetryableLlmStatus = (status: number) =>
  status === 408 ||
  status === 409 ||
  status === 425 ||
  status === 429 ||
  status >= 500;

const fetchChatCompletionWithRetry = async (
  config: LlmConfig,
  body: unknown,
): Promise<Response> => {
  const retryDelays = [2000, 5000, 10000];
  let lastStatus = 0;
  let lastDetails = "";

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return response;
    }

    lastStatus = response.status;
    lastDetails = await response.text();

    if (
      attempt === retryDelays.length ||
      !isRetryableLlmStatus(response.status)
    ) {
      break;
    }

    await sleep(retryAfterMs(response, retryDelays[attempt] ?? 10000));
  }

  redirectWithError(
    `${config.provider} SOP revision failed after retries: ${lastStatus} ${lastDetails.slice(0, 500)}`,
  );
  throw new Error("LLM revision failed after retries.");
};

const reviseWithLlm = async (
  raw: string,
  qualityFeedback?: string[],
): Promise<RevisedArticle> => {
  const config = requireLlmConfig();

  const response = await fetchChatCompletionWithRetry(config, {
    model: config.model,
    messages: [
      { role: "system", content: REVISION_SYSTEM_PROMPT },
      { role: "user", content: buildSopRevisionPrompt(raw, qualityFeedback) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.25,
    max_tokens: 12000,
  });

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content) as Partial<RevisedArticle>;

    const bodyZh = parsed.bodyZh;
    const bodyEn = parsed.bodyEn;

    if (!bodyZh || !bodyEn) {
      redirectWithError("SOP revision returned incomplete article body.");
      throw new Error("Incomplete SOP revision.");
    }

    return {
      ...parsed,
      bodyEn,
      bodyZh,
    };
  } catch {
    redirectWithError("SOP revision returned invalid JSON.");
    throw new Error("Invalid SOP revision JSON.");
  }
};

const buildResearchPrimer = (raw: string) => {
  const rows = [
    [
      "Original title",
      metadataLine(raw, "Original title") || frontmatterValue(raw, "title"),
    ],
    ["Authors", metadataLine(raw, "Authors")],
    ["Journal/source", metadataLine(raw, "Journal/source")],
    ["DOI", metadataLine(raw, "DOI") || frontmatterValue(raw, "doi")],
    ["PubMed/source link", metadataLine(raw, "PubMed/source link")],
    ["Open-access link", metadataLine(raw, "Open-access link")],
    ["Evidence used", metadataLine(raw, "Evidence used")],
    [
      "Published or indexed date",
      metadataLine(raw, "Published or indexed date") ||
        frontmatterValue(raw, "publishedAt"),
    ],
  ].filter(([, value]) => value);

  return rows.map(([label, value]) => `- ${label}: ${value}`).join("\n");
};

const buildRevisedMdx = (
  raw: string,
  revised: RevisedArticle,
  evaluation: QualityEvaluation,
) => {
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const matchedFrontmatter = frontmatterMatch?.[1];

  if (!matchedFrontmatter) {
    redirectWithError("Draft frontmatter is missing.");
    throw new Error("Draft frontmatter is missing.");
  }

  let frontmatter = withQualityFrontmatter(matchedFrontmatter, evaluation);
  if (revised.titleZh && revised.titleEn) {
    frontmatter = replaceFrontmatterValue(
      frontmatter,
      "title",
      `${revised.titleZh} / ${revised.titleEn}`,
    );
  }
  if (revised.descriptionZh && revised.descriptionEn) {
    frontmatter = replaceFrontmatterValue(
      frontmatter,
      "description",
      `${revised.descriptionZh} ${revised.descriptionEn}`,
    );
  }

  const body = [
    "> 本站文章基于公开学术文献进行第三方评论，不代表原文作者及出版机构立场。本文仅供科普参考，不构成医疗建议。如有健康问题，请咨询专业医生。",
    "",
    "## 原文精华摘要",
    "",
    normalizeReaderArticle(cleanMarkdown(revised.bodyZh ?? "")),
    "",
    "你可以带走的重点",
    "",
    ...(revised.takeawaysZh ?? []).map((item) => `- ${item}`),
    "",
    "## English Plain-Language Version",
    "",
    cleanMarkdown(revised.bodyEn ?? ""),
    "",
    "Practical Takeaways",
    "",
    ...(revised.takeawaysEn ?? []).map((item) => `- ${item}`),
    "",
    "## Research Primer / 参考文献",
    "",
    buildResearchPrimer(raw),
    "",
    "如需阅读原文，请点击链接获取完整内容。",
    "",
    "本站文章基于公开学术文献进行第三方评论，不代表原文作者及出版机构立场。如涉版权问题，请权利人联系下架。",
    "",
  ].join("\n");

  return `---\n${frontmatter.trim()}\n---\n\n${body}`;
};

export async function reviseDraftWithSopAction(formData: FormData) {
  const token = requireGithubWriteToken();

  const contentPath = getFormString(formData, "contentPath");
  const slug = getFormString(formData, "slug");
  const title = getFormString(formData, "title") || slug;

  assertContentPath(contentPath);

  const current = await readGithubFile(contentPath, token);

  if (
    !/^draft:\s*true\s*$/m.test(current.raw) &&
    !/^reviewRequired:\s*true\s*$/m.test(current.raw) &&
    !/^qualityStatus:\s*needs_revision\s*$/m.test(current.raw)
  ) {
    redirectWithError("Only review articles can be revised.");
  }

  let attemptRaw = current.raw;
  let revised = await reviseWithLlm(attemptRaw);
  let evaluation = evaluateRevisedArticle(revised);

  for (let attempt = 2; attempt <= 5 && !evaluation.ready; attempt += 1) {
    attemptRaw = buildRevisionAttemptRaw(current.raw, revised, evaluation);

    const nextRevision = await reviseWithLlm(attemptRaw, evaluation.issues);
    const nextEvaluation = evaluateRevisedArticle(nextRevision);

    if (
      nextEvaluation.ready ||
      revisionScore(nextRevision, nextEvaluation) >=
        revisionScore(revised, evaluation)
    ) {
      revised = nextRevision;
      evaluation = nextEvaluation;
    }
  }

  const updated = buildRevisedMdx(current.raw, revised, evaluation);

  await writeGithubFile({
    apiUrl: current.apiUrl,
    branch: current.repoBranch,
    content: updated,
    headers: current.headers,
    message: `revise: ${title}`,
    sha: current.sha,
  });

  await triggerPublishWorkflow(token);
  revalidateAdminDrafts(slug);

  if (!evaluation.ready) {
    redirect(
      `${pathsConfig.admin.drafts.index}?revisionWarning=${encodeURIComponent(slug)}&issues=${encodeURIComponent(evaluation.issues.join("; "))}`,
    );
  }

  redirect(
    `${pathsConfig.admin.drafts.index}?revised=${encodeURIComponent(slug)}`,
  );
}

export async function publishDraftAction(formData: FormData) {
  const token = requireGithubWriteToken();

  const contentPath = getFormString(formData, "contentPath");
  const forcePublish = getFormString(formData, "forcePublish") === "true";
  const slug = getFormString(formData, "slug");
  const title = getFormString(formData, "title") || slug;
  const topic = getFormString(formData, "topic");

  const allowedTopics = new Set([
    "prediabetes",
    "cgm",
    "diet",
    "exercise-sleep",
    "stress-emotion",
    "metabolic-health",
  ]);
  if (!allowedTopics.has(topic)) {
    redirectWithError("Please choose a valid destination section.");
  }

  assertContentPath(contentPath);

  const current = await readGithubFile(contentPath, token);
  const raw = current.raw;

  if (!/^draft:\s*true\s*$/m.test(raw)) {
    redirectWithError("This article is no longer a draft.");
  }

  if (!forcePublish && /^reviewRequired:\s*true\s*$/m.test(raw)) {
    redirectWithError(
      "This draft still needs SOP revision. Please run SOP revision again or edit the draft before publishing.",
    );
  }

  if (!forcePublish && /^qualityStatus:\s*needs_revision\s*$/m.test(raw)) {
    redirectWithError(
      "This draft is marked needs_revision. Finish the SOP rewrite before publishing.",
    );
  }

  const quality = evaluateRawDraft(raw);

  if (!forcePublish && !quality.ready) {
    redirectWithError(
      `This draft still fails the SOP quality gate: ${quality.issues.join("; ")}`,
    );
  }

  const updated = [
    ["draft", "false"],
    ["reviewRequired", "false"],
    ["qualityStatus", "ready"],
    ["topic", topic],
    ...(forcePublish ? ([["manualOverride", "true"]] as const) : []),
  ].reduce(
    (content, [key, value]) =>
      replaceRawFrontmatterLiteral(content, key, value),
    removeRawQualityIssues(raw),
  );

  await writeGithubFile({
    apiUrl: current.apiUrl,
    branch: current.repoBranch,
    content: updated,
    headers: current.headers,
    message: forcePublish
      ? `publish: ${title} (manual override)`
      : `publish: ${title}`,
    sha: current.sha,
  });

  await triggerPublishWorkflow(token);
  revalidateAdminDrafts(slug);

  redirect(
    `${pathsConfig.admin.drafts.index}?published=${encodeURIComponent(slug)}`,
  );
}
