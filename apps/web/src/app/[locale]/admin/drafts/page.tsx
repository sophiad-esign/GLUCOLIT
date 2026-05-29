/* eslint-disable i18next/no-literal-string */

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui-web/table";

import { getMetadata } from "~/lib/metadata";
import { getReviewArticles } from "~/modules/articles/data";

import { publishDraftAction } from "./actions";

export const generateMetadata = getMetadata({
  title: "待审核文章草稿",
  description: "审核并发布 GLUCOLIT RSS 生成的文章草稿。",
});

export default async function AdminDraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; published?: string }>;
}) {
  const { error, published } = await searchParams;
  const drafts = getReviewArticles().filter((article) => article.draft);
  const canPublish = Boolean(
    process.env["GITHUB_CONTENT_TOKEN"] || process.env["GITHUB_TOKEN"],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium tracking-[0.18em] text-sky-100 uppercase">
              Protected Admin
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-normal">
              待审核文章草稿
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-sky-50">
              这里列出所有 frontmatter 里 draft: true
              的文章。点击一键发布后，系统会把对应 MDX 文件改成 draft: false
              并提交到 GitHub，随后 Vercel 自动重新部署。
            </p>
          </div>

          <div className="rounded-2xl bg-white/15 px-6 py-4 text-center">
            <div className="text-4xl font-bold">{drafts.length}</div>
            <div className="text-xs text-sky-100">待审核草稿</div>
          </div>
        </div>
      </section>

      {published ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-7 text-green-900 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-100">
          <Icons.CheckCircle2 className="mt-1 size-4 flex-none" />
          <p>
            已提交发布：{published}。GitHub main 更新后，Vercel
            会自动重新部署，稍等几十秒后公开页面会显示。
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
              页面已经受 /admin 登录保护；要让按钮真正写回仓库，请在 Vercel
              环境变量里添加 GITHUB_CONTENT_TOKEN，权限需要 Contents: Read and
              write。不要把 token 写进代码。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>草稿列表</CardTitle>
          <CardDescription>
            显示标题、摘要、创建日期和一键发布操作。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drafts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>创建日期</TableHead>
                  <TableHead>文件路径</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((article) => (
                  <TableRow key={article.slug}>
                    <TableCell className="min-w-80 whitespace-normal">
                      <div className="font-semibold">{article.titleZh}</div>
                      <div className="text-muted-foreground mt-1 text-xs leading-5">
                        {article.titleEn}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {article.categoryLabels.map((label) => (
                          <Badge key={label} variant="outline">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-96 text-sm leading-7 whitespace-normal">
                      {article.summaryZh}
                    </TableCell>
                    <TableCell>{article.publishedAtLabel}</TableCell>
                    <TableCell className="min-w-96 whitespace-normal">
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs leading-5 dark:bg-slate-900">
                        {article.contentPath}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
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
                        <Button
                          type="submit"
                          disabled={!canPublish}
                          className="bg-[#1e3a5f] hover:bg-[#2d5a87]"
                        >
                          一键发布
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <Icons.CheckCircle2 className="mx-auto size-10 text-green-600" />
              <h2 className="mt-4 text-xl font-semibold">暂无待审核草稿</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                所有研究文章都已经发布，或 RSS 工作流还没有生成新的 draft: true
                文件。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
