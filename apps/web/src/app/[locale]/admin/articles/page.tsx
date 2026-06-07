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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui-web/table";

import { pathsConfig } from "~/config/paths";
import { getMetadata } from "~/lib/metadata";
import { getReviewArticlesFromFiles } from "~/modules/articles/review-files";
import { TurboLink } from "~/modules/common/turbo-link";

export const generateMetadata = getMetadata({
  title: "文章审核后台",
  description: "查看 GLUCOLIT RSS 自动生成的待审核文章草稿。",
});

export default function AdminArticlesPage() {
  const articles = getReviewArticlesFromFiles();
  const drafts = articles.filter((article) => article.draft);
  const published = articles.filter((article) => !article.draft);
  const latestDrafts = drafts.slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium tracking-[0.18em] text-sky-100 uppercase">
              GLUCOLIT CMS
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-normal">
              文章审核后台
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-sky-50">
              RSS
              工作流生成的文章会先进入草稿池。确认内容质量后，再从草稿审核页发布到公开网站。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/15 px-4 py-3">
              <div className="text-3xl font-bold">{articles.length}</div>
              <div className="text-xs text-sky-100">总文章</div>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3">
              <div className="text-3xl font-bold">{drafts.length}</div>
              <div className="text-xs text-sky-100">待审核</div>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3">
              <div className="text-3xl font-bold">{published.length}</div>
              <div className="text-xs text-sky-100">已发布</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>待审核草稿在哪里？</CardTitle>
            <CardDescription>
              每篇文章都是一个文件夹，真正要审核的是里面的 en.mdx。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border bg-slate-50 p-4 font-mono text-sm leading-7 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              packages/cms/src/collections/blog/content/
              <br />
              article-slug/
              <br />
              &nbsp;&nbsp;en.mdx
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <Icons.AlertTriangle className="mt-1 size-4 flex-none" />
              <p>
                自动生成文章默认不会公开。只要保持 draft: true，首页和 /articles
                都不会显示它。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>发布步骤</CardTitle>
            <CardDescription>人工审核通过后再发布。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7">
            <p>1. 打开草稿审核页。</p>
            <p>2. 检查中文摘要、英文摘要和原文链接。</p>
            <p>3. 点击一键发布。</p>
            <p>4. GitHub 更新后，Vercel 会自动重新部署。</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">
              最新待审核草稿
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              越靠前越新，可以优先审核。
            </p>
          </div>
          <TurboLink
            href={pathsConfig.admin.drafts.index}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#1e3a5f] hover:text-[#2d5a87] dark:text-sky-200"
          >
            去草稿审核页
            <Icons.ArrowUpRight className="size-4" />
          </TurboLink>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {latestDrafts.map((article) => (
            <Card key={article.slug} className="overflow-hidden">
              <CardHeader>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">待审核</Badge>
                  <Badge variant="outline">{article.publishedAtLabel}</Badge>
                </div>
                <CardTitle className="line-clamp-2 text-base leading-snug">
                  {article.titleZh}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {article.titleEn}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {article.summaryZh}
                </p>
                <code className="block rounded-lg bg-slate-100 p-3 text-xs leading-5 whitespace-normal text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {article.contentPath}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>全部文章状态表</CardTitle>
          <CardDescription>
            包含待审核草稿和已经发布到公开页面的文章。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>状态</TableHead>
                <TableHead>中文标题</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>文件路径</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.slug}>
                  <TableCell>
                    <Badge variant={article.draft ? "secondary" : "default"}>
                      {article.draft ? "待审核" : "已发布"}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-80 whitespace-normal">
                    <div className="font-medium">{article.titleZh}</div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {article.titleEn}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64 text-sm whitespace-normal">
                    {article.source}
                  </TableCell>
                  <TableCell>{article.publishedAtLabel}</TableCell>
                  <TableCell className="min-w-96 whitespace-normal">
                    <code className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-900">
                      {article.contentPath}
                    </code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
