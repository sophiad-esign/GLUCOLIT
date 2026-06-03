/* eslint-disable i18next/no-literal-string */

import { notFound } from "next/navigation";

import { Badge } from "@workspace/ui-web/badge";
import { Button } from "@workspace/ui-web/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui-web/card";
import { Icons } from "@workspace/ui-web/icons";

import { pathsConfig } from "~/config/paths";
import { getMetadata } from "~/lib/metadata";
import { getReviewArticleBySlug } from "~/modules/articles/data";
import { TurboLink } from "~/modules/common/turbo-link";

import { publishDraftAction } from "../actions";

const proseLines = (content: string) =>
  content
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

const ReviewProse = ({ content }: { content: string }) => (
  <div className="space-y-5 text-base leading-8 text-slate-700 dark:text-slate-200">
    {proseLines(content).map((line, index) => {
      if (/^[-*]\s+/.test(line)) {
        return (
          <ul key={`${line}-${index}`} className="list-disc space-y-2 pl-6">
            {line.split(/\n/).map((item) => (
              <li key={item}>{item.replace(/^[-*]\s+/, "")}</li>
            ))}
          </ul>
        );
      }

      return (
        <p key={`${line}-${index}`} className="whitespace-pre-line">
          {line}
        </p>
      );
    })}
  </div>
);

export const generateMetadata = getMetadata({
  title: "草稿全文审核",
  description: "阅读全文后再决定是否一键发布。",
});

export default async function DraftPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getReviewArticleBySlug(slug);

  if (!article || !article.draft) {
    notFound();
  }

  const canPublish = Boolean(
    process.env["GITHUB_CONTENT_TOKEN"] || process.env["GITHUB_TOKEN"],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TurboLink
          href={pathsConfig.admin.drafts.index}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          <Icons.ArrowLeft className="size-4" />
          返回草稿列表
        </TurboLink>

        <form action={publishDraftAction}>
          <input type="hidden" name="contentPath" value={article.contentPath} />
          <input type="hidden" name="slug" value={article.slug} />
          <input
            type="hidden"
            name="title"
            value={article.titleEn || article.titleZh}
          />
          <Button
            type="submit"
            disabled={!canPublish}
            className="w-full bg-[#1e3a5f] hover:bg-[#2d5a87] sm:w-auto"
          >
            一键发布这篇文章
          </Button>
        </form>
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] p-6 text-white shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">待审核</Badge>
            <Badge variant="secondary">{article.publishedAtLabel}</Badge>
            {article.categoryLabels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-normal">
              {article.titleZh}
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-sky-50">
              {article.titleEn}
            </p>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-2xl bg-white/15 p-4">
              <div className="text-sky-100">来源</div>
              <div className="mt-1 font-semibold">{article.source}</div>
            </div>
            <div className="rounded-2xl bg-white/15 p-4">
              <div className="text-sky-100">DOI</div>
              <div className="mt-1 font-semibold break-all">
                {article.doi || "暂无"}
              </div>
            </div>
            <div className="rounded-2xl bg-white/15 p-4">
              <div className="text-sky-100">审核重点</div>
              <div className="mt-1 font-semibold">是否通俗、准确、有用</div>
            </div>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>审核提示</CardTitle>
          <CardDescription>
            重点看中文白话版是否像写给普通人的健康科普：说人话、有解释、有边界，不夸大疗效。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-7 md:grid-cols-3">
          <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
            <div className="font-semibold">可读性</div>
            <p className="text-muted-foreground mt-1">
              普通读者是否能看懂，不堆术语。
            </p>
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
            <div className="font-semibold">准确性</div>
            <p className="text-muted-foreground mt-1">
              是否保留研究结论边界，不把相关性写成因果。
            </p>
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
            <div className="font-semibold">实用性</div>
            <p className="text-muted-foreground mt-1">
              是否能帮糖尿病前期读者理解该怎么行动。
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>中文白话全文</CardTitle>
            <CardDescription>
              这是给中文读者看的主要版本，也是你审核时最该细读的部分。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewProse content={article.bodyZh} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>English Plain-Language Version</CardTitle>
            <CardDescription>
              Use this to compare whether the bilingual rewrite is consistent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewProse content={article.bodyEn} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>原文与文件</CardTitle>
          <CardDescription>
            需要进一步核查时，可以打开期刊原文或查看仓库文件路径。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {article.originalUrl ? (
            <a
              href={article.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
            >
              打开原文链接
              <Icons.ArrowUpRight className="size-4" />
            </a>
          ) : null}
          <code className="block rounded-xl bg-slate-100 p-4 text-xs break-all dark:bg-slate-900">
            {article.contentPath}
          </code>
          <p className="text-muted-foreground leading-7">
            免责声明：本文仅供科普参考，不构成医疗建议。如有健康问题，请咨询专业医生。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
