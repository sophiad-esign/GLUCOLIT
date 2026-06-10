/* eslint-disable i18next/no-literal-string */

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
import { getReviewArticlesFromFiles } from "~/modules/articles/review-files";
import { TurboLink } from "~/modules/common/turbo-link";

import { publishDraftAction, reviseDraftWithSopAction } from "./actions";
import { AutoUpdateStatus } from "./auto-update-status";
import { SubmitActionButton } from "./submit-action-button";

const actionButtonClass =
  "inline-flex h-10 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:pointer-events-none disabled:opacity-50";

export const generateMetadata = getMetadata({
  title: "待审核文章草稿",
  description: "审核并发布 GLUCOLIT RSS 自动生成的文章草稿。",
});

export default async function AdminDraftsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    published?: string;
    revised?: string;
  }>;
}) {
  const { error, published, revised } = await searchParams;
  const drafts = getReviewArticlesFromFiles().filter(
    (article) => article.draft,
  );
  const canPublish = Boolean(
    process.env["GITHUB_CONTENT_TOKEN"] || process.env["GITHUB_TOKEN"],
  );
  const canRevise = Boolean(
    canPublish &&
    (process.env["KIMI_API_KEY"] || process.env["OPENAI_API_KEY"]),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium tracking-[0.18em] text-sky-100 uppercase">
              GLUCOLIT CMS
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-normal">
              待审核文章草稿
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-sky-50">
              这里列出所有 frontmatter 里 draft: true
              的文章。审核通过后点击一键发布， 系统会把对应 MDX 文件改成 draft:
              false，并提交到 GitHub；Vercel 会随后自动重新部署。
            </p>
          </div>

          <div className="rounded-2xl bg-white/15 px-6 py-4 text-center">
            <div className="text-4xl font-bold">{drafts.length}</div>
            <div className="text-xs text-sky-100">待审核草稿</div>
          </div>
        </div>
      </section>

      <AutoUpdateStatus canPublish={canPublish} />

      {published ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-7 text-green-900 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-100">
          <Icons.CheckCircle2 className="mt-1 size-4 flex-none" />
          <p>
            已提交发布：{published}。GitHub main 更新后，Vercel 会自动重新部署，
            稍等几十秒后公开页面会显示。
          </p>
        </div>
      ) : null}

      {revised ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
          <Icons.CheckCircle2 className="mt-1 size-4 flex-none" />
          <p>
            已按 SOP 提交深度修订：{revised}。GitHub main 更新后，Vercel
            会自动重新部署， 稍等几十秒后这篇会变成可发布候选。
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
          <Icons.AlertTriangle className="mt-1 size-4 flex-none" />
          <p>{error}</p>
        </div>
      ) : null}

      {!canPublish ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950 dark:text-amber-100">
              <Icons.Key className="size-5" />
              一键发布需要 GitHub 写入 Token
            </CardTitle>
            <CardDescription className="text-amber-900 dark:text-amber-100/80">
              要让按钮真正写回仓库，请在 Vercel 环境变量里添加
              GITHUB_CONTENT_TOKEN，权限需要 Contents: Read and write。不要把
              token 写进代码。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {canPublish && !canRevise ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950 dark:text-amber-100">
              <Icons.Key className="size-5" />
              SOP 自动修订需要 Kimi 或 OpenAI API Key
            </CardTitle>
            <CardDescription className="text-amber-900 dark:text-amber-100/80">
              请在 Vercel 环境变量里添加 KIMI_API_KEY，或
              OPENAI_API_KEY。添加后重新部署， 后台就会出现可点击的“按 SOP
              自动修订”按钮。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>怎么审核？</CardTitle>
          <CardDescription>
            先读标题和摘要。觉得内容质量可以公开，就点每张卡片右上角的一键发布。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-7 md:grid-cols-3">
          <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
            <div className="font-semibold">1. 看标题</div>
            <p className="text-muted-foreground mt-1">
              确认主题和糖尿病前期、胰岛素抵抗或生活方式干预有关。
            </p>
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
            <div className="font-semibold">2. 看摘要</div>
            <p className="text-muted-foreground mt-1">
              中文摘要是否通顺，是否像普通人能读懂的科普解释。
            </p>
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
            <div className="font-semibold">3. 点发布</div>
            <p className="text-muted-foreground mt-1">
              发布后会自动写回 GitHub，并触发 Vercel 更新公开网站。
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-normal">草稿列表</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            每篇草稿都是一张审核卡片，一键发布按钮在卡片右上角。
          </p>
        </div>

        {drafts.length > 0 ? (
          <div className="space-y-4">
            {drafts.map((article, index) => (
              <Card key={article.slug} className="overflow-hidden">
                <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">待审核 #{index + 1}</Badge>
                      <Badge
                        variant={
                          article.reviewRequired ? "destructive" : "default"
                        }
                      >
                        {article.reviewRequired ? "需 SOP 修订" : "可发布候选"}
                      </Badge>
                      <Badge variant="outline">
                        {article.publishedAtLabel}
                      </Badge>
                      {article.categoryLabels.map((label) => (
                        <Badge key={label} variant="outline">
                          {label}
                        </Badge>
                      ))}
                    </div>
                    <div>
                      <CardTitle className="text-xl leading-snug">
                        {article.titleZh}
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm leading-6">
                        {article.titleEn}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                    <TurboLink
                      href={pathsConfig.admin.drafts.draft(article.slug)}
                      className="inline-flex h-10 w-full items-center justify-center rounded-md border bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                    >
                      查看全文审核
                    </TurboLink>
                    {article.reviewRequired ? (
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
                    ) : null}
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
                      <SubmitActionButton
                        disabled={!canPublish || article.reviewRequired}
                        className={`${actionButtonClass} bg-[#1e3a5f] hover:bg-[#2d5a87]`}
                        pendingText="正在发布..."
                      >
                        {article.reviewRequired ? "先完成修订" : "一键发布"}
                      </SubmitActionButton>
                    </form>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 dark:bg-slate-900">
                    <div className="mb-2 font-semibold">中文摘要</div>
                    <p className="text-slate-700 dark:text-slate-200">
                      {article.summaryZh}
                    </p>
                  </div>

                  {article.reviewRequired ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                      <div className="font-semibold">SOP 修订清单</div>
                      <p className="mt-1 text-amber-900 dark:text-amber-100/80">
                        这篇已经进入草稿库，但还不能直接发布。请按问题修订后，把
                        reviewRequired 改为 false、qualityStatus 改为 ready。
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {article.qualityIssues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="grid gap-3 text-sm lg:grid-cols-[1fr_2fr]">
                    <div className="rounded-xl border p-3">
                      <div className="text-muted-foreground text-xs">来源</div>
                      <div className="mt-1 font-medium">{article.source}</div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-muted-foreground text-xs">
                        文件路径
                      </div>
                      <code className="mt-1 block text-xs break-all">
                        {article.contentPath}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <Icons.CheckCircle2 className="mx-auto size-10 text-green-600" />
            <h2 className="mt-4 text-xl font-semibold">暂无待审核草稿</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              所有研究文章都已经发布，或者 RSS 工作流还没有生成新的 draft: true
              文件。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
