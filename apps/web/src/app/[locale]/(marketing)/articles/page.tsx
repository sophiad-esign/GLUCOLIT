/* eslint-disable i18next/no-literal-string */

import { ArticleCard } from "~/modules/articles/article-card";
import {
  ARTICLE_CATEGORY_OPTIONS,
  getPublishedArticles,
  TOPIC_CLUSTERS,
} from "~/modules/articles/data";
import { TurboLink } from "~/modules/common/turbo-link";

export const metadata = {
  title: "GLUCOLIT 干预指南库",
  description:
    "糖尿病前期、胰岛素抵抗、饮食、运动、睡眠、压力、补充剂与 CGM 相关的医学科普干预指南。",
};

export default async function ArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const { category = "all", sort = "newest" } = await searchParams;
  const articles = getPublishedArticles({ category, sort });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-[#2d5a87]/20 bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] px-6 py-10 text-white shadow-sm sm:px-10">
        <p className="text-sm font-medium tracking-[0.18em] text-sky-100 uppercase">
          GLUCOLIT Intervention Guides
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-normal sm:text-5xl">
          糖尿病前期与代谢健康干预指南库
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-sky-50">
          这里收录面向糖前期生活方式干预的专业指南。顶部先给结论、评分和行动清单，研究证据放在底部，方便你核查
          PubMed、DOI 或开放获取原文。
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
          Pillar pages
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
          按主题支柱页阅读
        </h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {TOPIC_CLUSTERS.map((topic) => (
            <TurboLink
              key={topic.slug}
              href={`/guide/${topic.slug}`}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#2d5a87]/40 hover:bg-[#2d5a87]/8 hover:text-[#1e3a5f] dark:border-slate-800 dark:text-slate-200"
            >
              {topic.title}
            </TurboLink>
          ))}
        </div>
      </section>

      <form className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end dark:border-slate-800 dark:bg-slate-950">
        <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          按干预/主题筛选
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
            <ArticleCard key={article.slug} article={article} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
            暂无已发布文章
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            草稿需要先在后台审核并一键发布，才会出现在指南库。
          </p>
        </div>
      )}
    </main>
  );
}
