import { ArticleCard } from "~/modules/articles/article-card";
/* eslint-disable i18next/no-literal-string */
import {
  getPublishedArticles,
  ARTICLE_CATEGORY_OPTIONS,
} from "~/modules/articles/data";

export const metadata = {
  title: "GLUCOLIT Articles",
  description: "糖尿病前期、胰岛素抵抗与生活方式干预的双语科普文章。",
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category = "all", sort = "newest" } = await searchParams;
  const articles = getPublishedArticles({ category, sort });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] px-6 py-10 text-white shadow-xl sm:px-10">
        <p className="text-sm font-medium tracking-[0.18em] text-sky-100 uppercase">
          GLUCOLIT Research Radar
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-normal sm:text-5xl">
          糖尿病前期权威科普文章库
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-sky-50">
          追踪国际期刊里的糖尿病前期、胰岛素抵抗和生活方式干预研究，审核后转成中英文白话科普。
        </p>
      </section>

      <form className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end dark:border-slate-800 dark:bg-slate-950">
        <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          按分类筛选
          <select
            name="category"
            defaultValue={category}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition outline-none focus:border-[#2d5a87] focus:ring-2 focus:ring-[#2d5a87]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {ARTICLE_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          按日期排序
          <select
            name="sort"
            defaultValue={sort}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition outline-none focus:border-[#2d5a87] focus:ring-2 focus:ring-[#2d5a87]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="newest">最新优先</option>
            <option value="oldest">最早优先</option>
          </select>
        </label>

        <button
          type="submit"
          className="h-11 rounded-lg bg-[#1e3a5f] px-5 text-sm font-semibold text-white transition hover:bg-[#2d5a87]"
        >
          筛选
        </button>
      </form>

      {articles.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
            暂无已发布文章
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            当前 RSS 生成文章仍处于草稿审核状态。把确认可发布的文章 frontmatter
            改为
            <code className="mx-1 rounded bg-white px-1.5 py-0.5 dark:bg-slate-950">
              draft: false
            </code>
            后，这里会自动展示。
          </p>
        </div>
      )}
    </main>
  );
}
