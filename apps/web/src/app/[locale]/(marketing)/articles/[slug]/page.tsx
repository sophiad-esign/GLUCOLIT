/* eslint-disable i18next/no-literal-string */

import { notFound } from "next/navigation";

import { buttonVariants } from "@workspace/ui-web/button";

import { pathsConfig } from "~/config/paths";
import { ArticleReader } from "~/modules/articles/article-reader";
import {
  getAllPublishedArticleSlugs,
  getPublishedArticleBySlug,
} from "~/modules/articles/data";
import { TurboLink } from "~/modules/common/turbo-link";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const article = getPublishedArticleBySlug((await params).slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <article>
        <header className="relative rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] px-6 py-10 text-white shadow-xl sm:px-10">
          <div className="max-w-3xl">
            <h1 className="text-3xl leading-tight font-bold tracking-normal sm:text-5xl">
              {article.titleZh}
            </h1>
            <p className="mt-4 text-base leading-7 text-sky-100">
              {article.titleEn}
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-3 py-1 font-medium text-white">
                {article.source}
              </span>
              <time
                dateTime={article.publishedAt.toISOString()}
                className="rounded-full bg-white/15 px-3 py-1 text-white"
              >
                {article.publishedAtLabel}
              </time>
              {article.doi ? (
                <a
                  href={`https://doi.org/${article.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white/15 px-3 py-1 text-white underline-offset-4 hover:underline"
                >
                  DOI: {article.doi}
                </a>
              ) : (
                <span className="rounded-full bg-white/15 px-3 py-1 text-white">
                  DOI 暂无
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="mt-8">
          <ArticleReader article={article} />
        </div>

        <footer className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap gap-3">
            {article.originalUrl ? (
              <a
                href={article.originalUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants()}
              >
                查看原文
              </a>
            ) : null}
            <TurboLink
              href={pathsConfig.marketing.articles.index}
              className={buttonVariants({ variant: "outline" })}
            >
              返回列表
            </TurboLink>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
            本文仅供科普参考，不构成医疗建议。如有健康问题，请咨询专业医生。
          </p>
        </footer>
      </article>
    </main>
  );
}

export function generateStaticParams() {
  return getAllPublishedArticleSlugs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const article = getPublishedArticleBySlug((await params).slug);

  if (!article) {
    return {};
  }

  return {
    title: article.titleZh,
    description: article.summaryZh,
  };
}
