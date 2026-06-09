/* eslint-disable i18next/no-literal-string */

import { withI18n } from "@workspace/i18n/with-i18n";
import { buttonVariants } from "@workspace/ui-web/button";

import { pathsConfig } from "~/config/paths";
import { ArticleCard } from "~/modules/articles/article-card";
import { getPublishedArticles, TOPIC_CLUSTERS } from "~/modules/articles/data";
import { TurboLink } from "~/modules/common/turbo-link";

const HomePage = async ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => {
  const { locale } = await params;
  const articles = getPublishedArticles({ limit: 9 });

  return (
    <main className="w-full">
      <section className="border-b bg-gradient-to-b from-slate-50 to-white px-4 py-16 sm:px-6 lg:px-8 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <p className="text-sm font-semibold tracking-[0.22em] text-[#2d5a87] uppercase dark:text-sky-200">
              Evidence-based metabolic health briefing
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl leading-tight font-bold tracking-normal text-slate-950 sm:text-6xl dark:text-white">
              Glucolit | 糖尿病前期与代谢健康干预指南
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              每天追踪国际前沿最新研究，把糖尿病前期、胰岛素抵抗、饮食、运动、睡眠、压力、补充剂和
              CGM 相关证据，转化成普通读者能执行的干预指南。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <TurboLink
                href={pathsConfig.marketing.articles.index}
                className={buttonVariants({
                  className: "bg-[#1e3a5f] hover:bg-[#2d5a87]",
                })}
              >
                进入文献库
              </TurboLink>
              <TurboLink
                href="/subscribe"
                className={buttonVariants({ variant: "outline" })}
              >
                订阅每日更新
              </TurboLink>
            </div>
          </div>

          <aside className="rounded-2xl border border-[#2d5a87]/20 bg-white p-6 shadow-sm dark:border-sky-300/20 dark:bg-slate-950">
            <p className="text-sm font-semibold text-[#1e3a5f] dark:text-sky-200">
              今日关注
            </p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              <p>
                优先追踪 PubMed、PubMed Central、Europe PMC 与开放获取论文。
              </p>
              <p>
                内容按 Diet / Exercise / Sleep / Stress / Supplements
                的干预路径组织，而不是只按疾病分类。
              </p>
              <p>新文章先进入后台草稿库，人工审核后才会发布到前台。</p>
              <p>所有医学内容仅供科普参考，不替代医生诊疗建议。</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-7">
          <p className="text-sm font-semibold tracking-[0.18em] text-[#2d5a87] uppercase">
            Topic clusters
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
            从干预手段开始学习
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TOPIC_CLUSTERS.map((topic) => (
            <TurboLink
              key={topic.title}
              href={`/guide/${topic.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-[#2d5a87] uppercase dark:text-sky-200">
                {topic.kicker}
              </p>
              <h3 className="mt-3 text-2xl font-bold tracking-normal text-slate-950 group-hover:text-[#1e3a5f] dark:text-white">
                {topic.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                {topic.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {topic.searchKeywords.slice(0, 2).map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </TurboLink>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-[#2d5a87] uppercase">
              Latest research notes
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
              最新干预指南
            </h2>
          </div>
          <TurboLink
            href={pathsConfig.marketing.articles.index}
            className="text-sm font-semibold text-[#1e3a5f] underline-offset-4 hover:underline dark:text-sky-200"
          >
            查看全部指南
          </TurboLink>
        </div>

        {articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.slug}
                article={article}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
              暂无已发布文章
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              后台草稿通过人工审核并发布后，最新文章会显示在这里。
            </p>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] p-8 text-white sm:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-center">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-sky-100 uppercase">
                Daily update
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-normal">
                订阅每日文献更新
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-sky-50">
                每天追踪最新代谢健康研究，优先把可执行、证据边界清楚的内容放进草稿审核流程。
              </p>
            </div>
            <TurboLink
              href="/subscribe"
              className={buttonVariants({
                className: "bg-white text-[#1e3a5f] hover:bg-sky-50",
              })}
            >
              订阅
            </TurboLink>
          </div>
        </div>
      </section>
    </main>
  );
};

export default withI18n(HomePage);
