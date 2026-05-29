"use server";

import { redirect } from "next/navigation";

import { hasAdminPermission } from "@workspace/auth";

import { pathsConfig } from "~/config/paths";
import { getSession } from "~/lib/auth/server";

const CONTENT_ROOT = "packages/cms/src/collections/blog/content/";

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

export async function publishDraftAction(formData: FormData) {
  const { user } = await getSession();

  if (!user) {
    redirect(pathsConfig.auth.login);
  }

  if (!hasAdminPermission(user)) {
    redirect(pathsConfig.dashboard.user.index);
  }

  const token = envValue("GITHUB_CONTENT_TOKEN") || envValue("GITHUB_TOKEN");

  if (!token) {
    redirectWithError(
      "Missing Vercel env var GITHUB_CONTENT_TOKEN. Cannot write to GitHub.",
    );
  }

  const contentPath = getFormString(formData, "contentPath");
  const slug = getFormString(formData, "slug");
  const title = getFormString(formData, "title") || slug;

  assertContentPath(contentPath);

  const repoOwner = envValue("GITHUB_REPOSITORY_OWNER") || "sophiad-esign";
  const repoName = envValue("GITHUB_REPOSITORY")?.split("/")[1] || "GLUCOLIT";
  const repoBranch = envValue("GITHUB_CONTENT_BRANCH") || "main";
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${contentPath}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

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

  const raw = decodeBase64(currentContent);

  if (!/^draft:\s*true\s*$/m.test(raw)) {
    redirectWithError("This article is no longer a draft.");
  }

  const updated = raw.replace(/^draft:\s*true\s*$/m, "draft: false");

  const updateResponse = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `publish: ${title}`,
      content: encodeBase64(updated),
      sha: currentSha,
      branch: repoBranch,
    }),
  });

  if (!updateResponse.ok) {
    const details = await updateResponse.text();
    redirectWithError(
      `Failed to write GitHub file: ${updateResponse.status} ${details}`,
    );
  }

  redirect(
    `${pathsConfig.admin.drafts.index}?published=${encodeURIComponent(slug)}`,
  );
}
