import { TurboLink } from "~/modules/common/turbo-link";

import type { Article } from "./data";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <TurboLink
      href={`/articles/${article.slug}`}
      className="group block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-[#2d5a87] focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[#1e3a5f]/10 px-3 py-1 font-medium text-[#1e3a5f] dark:bg-sky-400/10 dark:text-sky-200">
            {article.source}
          </span>
          <time
            dateTime={article.publishedAt.toISOString()}
            className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
          >
            {article.publishedAtLabel}
          </time>
        </div>

        <h2 className="text-[18px] leading-snug font-bold text-slate-950 dark:text-white">
          {article.titleZh}
        </h2>
        <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
          {article.titleEn}
        </p>

        <p className="mt-4 line-clamp-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
          {article.summaryZh}
        </p>

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {article.categoryLabels.map((label) => (
            <span
              key={label}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {label}
            </span>
          ))}
        </div>
      </article>
    </TurboLink>
  );
}
