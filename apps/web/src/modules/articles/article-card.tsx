import { buttonVariants } from "@workspace/ui-web/button";

import { pathsConfig } from "~/config/paths";
import { TurboLink } from "~/modules/common/turbo-link";

import type { Article } from "./data";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#1e3a5f] px-3 py-1 text-xs font-semibold text-white">
          {article.evidenceLabel}
        </span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {article.reviewStatusLabel}
        </span>
        {article.categoryLabels.map((label) => (
          <span
            key={label}
            className="rounded-full border border-[#2d5a87]/20 bg-[#2d5a87]/8 px-3 py-1 text-xs font-medium text-[#1e3a5f] dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100"
          >
            {label}
          </span>
        ))}
      </div>

      <TurboLink
        href={pathsConfig.marketing.articles.article(article.slug)}
        className="focus-visible:ring-2 focus-visible:ring-[#2d5a87] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <h2 className="text-[18px] leading-snug font-bold text-slate-950 underline-offset-4 group-hover:text-[#1e3a5f] group-hover:underline dark:text-white dark:group-hover:text-sky-100">
          {article.titleZh}
        </h2>
      </TurboLink>

      <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
        {article.titleEn}
      </p>

      <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
        {article.summaryZh}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-6 text-xs text-slate-500 dark:text-slate-400">
        <time dateTime={article.publishedAt.toISOString()}>
          {article.publishedAtLabel}
        </time>
        <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span>{article.source}</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <TurboLink
          href={pathsConfig.marketing.articles.article(article.slug)}
          className={buttonVariants({
            size: "sm",
            className: "bg-[#1e3a5f] hover:bg-[#2d5a87]",
          })}
        >
          {/* oxlint-disable-next-line i18next/no-literal-string */}
          阅读解读
        </TurboLink>
        {article.doi ? (
          <a
            href={`https://doi.org/${article.doi}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            DOI
          </a>
        ) : null}
      </div>
    </article>
  );
}
