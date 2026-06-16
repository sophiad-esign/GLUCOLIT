"use server";

import { redirect } from "next/navigation";

import { pathsConfig } from "~/config/paths";

const CONTENT_ROOT = "packages/cms/src/collections/blog/content/";
const PUBLISH_WORKFLOW_FILE = "publish-web.yml";
const REVISION_SYSTEM_PROMPT =
  "You are a bilingual medical science editor for GLUCOLIT. Return only valid JSON.";

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

const countCjk = (value: string) =>
  (value.match(/[\u3400-\u9fff]/g) ?? []).length;

const countEnglishWords = (value: string) =>
  (value.match(/\b[A-Za-z][A-Za-z'-]*\b/g) ?? []).length;

const sectionBetweenHeadings = (
  content: string,
  heading: string,
  nextHeadings: string[],
) =>
  sectionText(content, heading, nextHeadings)
    .replace(/^#+\s+/gm, "")
    .trim();

const evaluateRevisedArticle = (revised: RevisedArticle): QualityEvaluation => {
  const bodyZh = cleanMarkdown(revised.bodyZh ?? "");
  const bodyEn = cleanMarkdown(revised.bodyEn ?? "");
  const issues: string[] = [];
  const headings = [
    "### 研究背景",
    "### 核心发现",
    "### 你的解读与批判",
    "### 临床/商业启发",
  ];

  headings.forEach((heading) => {
    if (!bodyZh.includes(heading)) {
      issues.push(
        `Missing required section: ${heading.replace(/^###\s*/, "")}`,
      );
    }
  });

  const background = sectionBetweenHeadings(bodyZh, "### 研究背景", [
    "### 核心发现",
    "### 你的解读与批判",
    "### 临床/商业启发",
  ]);
  const finding = sectionBetweenHeadings(bodyZh, "### 核心发现", [
    "### 你的解读与批判",
    "### 临床/商业启发",
  ]);
  const critique = sectionBetweenHeadings(bodyZh, "### 你的解读与批判", [
    "### 临床/商业启发",
  ]);
  const insight = sectionBetweenHeadings(bodyZh, "### 临床/商业启发", []);

  if (countCjk(bodyZh) < 1400) {
    issues.push(
      "Chinese SOP article is too short; it needs at least 1400 Chinese characters.",
    );
  }
  if (countCjk(background) < 80) {
    issues.push("Research background is too short.");
  }
  if (countCjk(finding) < 120) {
    issues.push("Core findings are too short or too vague.");
  }
  if (countCjk(critique) < 650) {
    issues.push("Interpretation and critique section is too short.");
  }
  if (countCjk(insight) < 350) {
    issues.push("Clinical/business insight section is too short.");
  }
  if (!/A[.、．：:]\s*给糖前读者/.test(insight)) {
    issues.push("Clinical action subsection A is missing.");
  }
  if (!/B[.、．：:]\s*给健康科技行业/.test(insight)) {
    issues.push("Business insight subsection B is missing.");
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
  if (/治愈|保证逆转|必然逆转|替代医生/.test(bodyZh)) {
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
  const bodyZh = sectionText(raw, "## 原文精华摘要", [
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

const revisionScore = (article: RevisedArticle) =>
  countCjk(article.bodyZh ?? "") + countEnglishWords(article.bodyEn ?? "") * 2;

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
  const currentZh = sectionText(raw, "## 原文精华摘要", [
    "## English Plain-Language Version",
    "## Source",
  ]);
  const currentEn = sectionText(raw, "## English Plain-Language Version", [
    "## Source",
    "## Research Primer",
  ]);

  return `
Rewrite this GLUCOLIT draft into a publishable review draft. The current draft is too thin and still looks like metadata plus translation.

${qualityFeedback?.length ? `The previous attempt failed these quality checks. Fix every item:\n- ${qualityFeedback.join("\n- ")}\n` : ""}

Hard rules:
- Use only the supplied source metadata, abstract/commentary fragments, DOI/PubMed links, and existing draft text. Do not invent sample sizes, statistics, populations, interventions, or outcomes that are not present.
- Do not scrape or imply access to paywalled full text.
- Move all metadata into the Research Primer. Do not put "Original title", "Authors", "Journal/source", "DOI", or "PubMed/source link" inside the Chinese article body.
- Chinese article should read like a helpful medical science column, not like a peer reviewer. Avoid repeated openings such as "这项研究", "这篇论文", "研究者发现".
- Paragraphs must be short. Each paragraph should be at most 5 visual lines on mobile, usually 80-140 Chinese characters. No giant blocks. No empty bullets.
- Keep uncertainty and causality boundaries clear. Do not say cure, reverse, guaranteed, or personalized treatment unless the evidence actually supports it.
- The final Chinese article must be long enough to publish: at least 1400 Chinese characters across the required sections.
- If the source does not provide exact numbers, explicitly say the source does not provide enough detail instead of inventing data.

Required Chinese body structure:
### 研究背景
100-180 Chinese characters. Start from the reader's real-life problem.

### 核心发现
Within 300 Chinese characters. Summarize only the strongest source-bounded finding.

### 你的解读与批判
At least 900 Chinese characters. Explain meaning, limits, what ordinary readers should not overclaim, and where the evidence is weak.

### 临床/商业启发
At least 450 Chinese characters. Include:
A. 给糖前读者的行动建议
B. 给健康科技行业的启发

English body:
- Under 220 English words.
- Plain language, same conclusion, no long detail.

Return JSON only:
{
  "titleZh": "...",
  "titleEn": "...",
  "descriptionZh": "...",
  "descriptionEn": "...",
  "bodyZh": "Markdown with the required Chinese headings",
  "bodyEn": "Plain English paragraphs",
  "takeawaysZh": ["...", "...", "...", "..."],
  "takeawaysEn": ["...", "...", "...", "..."]
}

Source metadata:
Original title: ${originalTitle}
Authors: ${authors}
Journal/source: ${source}
DOI: ${doi}
PubMed/source link: ${pubmed}
Open-access link: ${openAccess}
Evidence used: ${evidence}
Published or indexed date: ${date}

Current Chinese fragment:
${currentZh}

Current English fragment:
${currentEn}

Full current draft excerpt:
${existingBody}
`.trim();
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
    temperature: 0.35,
    max_tokens: 7600,
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
    cleanMarkdown(revised.bodyZh ?? ""),
    "",
    "### 你可以带走的重点",
    "",
    ...(revised.takeawaysZh ?? []).map((item) => `- ${item}`),
    "",
    "## English Plain-Language Version",
    "",
    cleanMarkdown(revised.bodyEn ?? ""),
    "",
    "### Practical Takeaways",
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

  if (!/^draft:\s*true\s*$/m.test(current.raw)) {
    redirectWithError("Only draft articles can be revised.");
  }

  const firstRevision = await reviseWithLlm(current.raw);
  const firstEvaluation = evaluateRevisedArticle(firstRevision);
  let revised = firstRevision;
  let evaluation = firstEvaluation;

  if (!firstEvaluation.ready) {
    const secondRevision = await reviseWithLlm(
      current.raw,
      firstEvaluation.issues,
    );
    const secondEvaluation = evaluateRevisedArticle(secondRevision);

    if (
      secondEvaluation.ready ||
      revisionScore(secondRevision) >= revisionScore(firstRevision)
    ) {
      revised = secondRevision;
      evaluation = secondEvaluation;
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
  const slug = getFormString(formData, "slug");
  const title = getFormString(formData, "title") || slug;

  assertContentPath(contentPath);

  const current = await readGithubFile(contentPath, token);
  const raw = current.raw;

  if (!/^draft:\s*true\s*$/m.test(raw)) {
    redirectWithError("This article is no longer a draft.");
  }

  if (/^reviewRequired:\s*true\s*$/m.test(raw)) {
    redirectWithError(
      "This draft still needs SOP revision. Please run SOP revision again or edit the draft before publishing.",
    );
  }

  if (/^qualityStatus:\s*needs_revision\s*$/m.test(raw)) {
    redirectWithError(
      "This draft is marked needs_revision. Finish the SOP rewrite before publishing.",
    );
  }

  const quality = evaluateRawDraft(raw);

  if (!quality.ready) {
    redirectWithError(
      `This draft still fails the SOP quality gate: ${quality.issues.join("; ")}`,
    );
  }

  const updated = raw
    .replace(/^draft:\s*true\s*$/m, "draft: false")
    .replace(/^qualityStatus:\s*ready\s*$/m, "qualityStatus: ready");

  await writeGithubFile({
    apiUrl: current.apiUrl,
    branch: current.repoBranch,
    content: updated,
    headers: current.headers,
    message: `publish: ${title}`,
    sha: current.sha,
  });

  await triggerPublishWorkflow(token);

  redirect(
    `${pathsConfig.admin.drafts.index}?published=${encodeURIComponent(slug)}`,
  );
}
