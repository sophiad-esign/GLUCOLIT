/* eslint-disable i18next/no-literal-string */

import { notFound } from "next/navigation";

import { Badge } from "@workspace/ui-web/badge";
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
import {
  getPrimaryTopicCluster,
  TOPIC_CLUSTERS,
} from "~/modules/articles/data";
import { readingBlocks } from "~/modules/articles/reading-blocks";
import { getAdminReviewArticleBySlug } from "~/modules/articles/review-files";
import { TurboLink } from "~/modules/common/turbo-link";

import { publishDraftAction, reviseDraftWithSopAction } from "../actions";
import { SubmitActionButton } from "../submit-action-button";

const actionButtonClass =
  "inline-flex h-10 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:pointer-events-none disabled:opacity-50 sm:w-auto";

const ReviewProse = ({ content }: { content: string }) => (
  <div className="space-y-5 text-base leading-8 text-slate-700 dark:text-slate-200">
    {readingBlocks(content).map((block, index) => {
      if (block.type === "list") {
        return (
          <ul key={`list-${index}`} className="list-disc space-y-2 pl-6">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        );
      }

      return (
        <p key={`${block.text}-${index}`} className="leading-8">
          {block.text}
        </p>
      );
    })}
  </div>
);

export const generateMetadata = getMetadata({
  title: "草稿全文审核",
  description: "阅读全文后再决定是否一键发布。",
});

export const dynamic = "force-dynamic";

export default async function DraftPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getAdminReviewArticleBySlug(slug);

  if (!article || !article.draft) {
    notFound();
  }

  const canPublish = Boolean(
    process.env["GITHUB_CONTENT_TOKEN"] || process.env["GITHUB_TOKEN"],
  );
  const canRevise = Boolean(
    canPublish &&
    (process.env["KIMI_API_KEY"] || process.env["OPENAI_API_KEY"]),
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

        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={reviseDraftWithSopAction}>
            <input
              type="hidden"
              name="contentPath"
              value={article.contentPath}
            />
            <input type="hidden" name="slug" value={article.slug} />
            <input
              type="hidden"
              name="title"
              value={article.titleEn || article.titleZh}
            />
            <SubmitActionButton
              disabled={!canRevise}
              className={`${actionButtonClass} bg-orange-600 hover:bg-orange-700`}
              pendingText="正在 SOP 修订..."
            >
              按 SOP 自动修订
            </SubmitActionButton>
          </form>
          <form action={publishDraftAction}>
            <input
              type="hidden"
              name="contentPath"
              value={article.contentPath}
            />
            <input type="hidden" name="slug" value={article.slug} />
            <input
              type="hidden"
              name="title"
              value={article.titleEn || article.titleZh}
            />
            <label className="mb-2 block text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              发布到板块
              <select
                name="topic"
                defaultValue={getPrimaryTopicCluster(article).slug}
                required
                className="mt-1 h-10 w-full rounded-md border bg-white px-2 text-sm text-slate-900 dark:bg-slate-950 dark:text-white"
              >
                {TOPIC_CLUSTERS.map((topic) => (
                  <option key={topic.slug} value={topic.slug}>
                    {topic.title}
                  </option>
                ))}
              </select>
            </label>
            {article.reviewRequired ? (
              <input type="hidden" name="forcePublish" value="true" />
            ) : null}
            <SubmitActionButton
              disabled={!canPublish}
              className={`${actionButtonClass} bg-[#1e3a5f] hover:bg-[#2d5a87]`}
              pendingText="正在发布..."
            >
              {article.reviewRequired ? "人工确认发布" : "一键发布这篇文章"}
            </SubmitActionButton>
          </form>
          {article.reviewRequired ? (
            <p className="max-w-[220px] text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
              会跳过 SOP 质量门，按你的人工判断直接发布。
            </p>
          ) : null}
        </div>
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] p-6 text-white shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">待审核</Badge>
            <Badge variant={article.reviewRequired ? "destructive" : "default"}>
              {article.reviewRequired ? "需 SOP 修订" : "可发布候选"}
            </Badge>
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

      {article.reviewRequired ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="text-amber-950 dark:text-amber-100">
              这篇还不能发布：需要 SOP 修订
            </CardTitle>
            <CardDescription className="text-amber-900 dark:text-amber-100/80">
              系统已经把候选稿放进后台，避免草稿库一直为空。但它还没有完全通过发布质量门，需要人工改稿后再发布。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-amber-950 dark:text-amber-100">
            {!canRevise ? (
              <p className="mb-3 rounded-xl border border-amber-300 bg-white/70 p-3">
                自动修订按钮当前不可用：请先在 Vercel 环境变量里配置
                KIMI_API_KEY 或 OPENAI_API_KEY，并确认 GITHUB_CONTENT_TOKEN
                仍然存在。
              </p>
            ) : null}
            <ul className="list-disc space-y-1 pl-5">
              {article.qualityIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>审核提示</CardTitle>
          <CardDescription>
            重点看原文精华摘要是否像写给普通人的健康科普：说人话、有解释、有边界，不夸大疗效。
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
            <CardTitle>原文精华摘要</CardTitle>
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
