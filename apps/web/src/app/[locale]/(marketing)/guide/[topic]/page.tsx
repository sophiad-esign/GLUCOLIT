/* eslint-disable i18next/no-literal-string */

import { notFound } from "next/navigation";

import { buttonVariants } from "@workspace/ui-web/button";

import { ArticleCard } from "~/modules/articles/article-card";
import {
  getTopicClusterArticles,
  getTopicClusterBySlug,
  TOPIC_CLUSTERS,
} from "~/modules/articles/data";
import { TurboLink } from "~/modules/common/turbo-link";
import { CompanionCoach } from "~/modules/companion/companion-coach";
import { FoodAnalyzer } from "~/modules/food/food-analyzer";
import { LifestyleTracker } from "~/modules/lifestyle/lifestyle-tracker";
import { OgttAnalyzer } from "~/modules/ogtt/ogtt-analyzer";

export function generateStaticParams() {
  return TOPIC_CLUSTERS.map((topic) => ({ topic: topic.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const topic = getTopicClusterBySlug((await params).topic);

  if (!topic) {
    return {};
  }

  return {
    title: `${topic.title} | GLUCOLIT 干预指南`,
    description: `${topic.description} 目标关键词：${topic.searchKeywords.join("、")}`,
  };
}

export default async function TopicGuidePage({
  params,
}: {
  params: Promise<{ locale: string; topic: string }>;
}) {
  const { locale, topic: topicSlug } = await params;
  const topic = getTopicClusterBySlug(topicSlug);

  if (!topic) {
    notFound();
  }

  const articles = getTopicClusterArticles(topic.slug);
  const siblingTopics = TOPIC_CLUSTERS.filter(
    (item) => item.slug !== topic.slug,
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] px-6 py-12 text-white shadow-sm sm:px-10">
        <p className="text-sm font-semibold tracking-[0.2em] text-sky-100 uppercase">
          {topic.kicker}
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl leading-tight font-bold tracking-normal sm:text-6xl">
          {topic.title}干预指南
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-sky-50 sm:text-lg">
          {topic.description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <TurboLink
            href="/articles"
            className={buttonVariants({
              className:
                "!bg-white !text-[#1e3a5f] hover:!bg-sky-50 focus-visible:!text-[#1e3a5f]",
            })}
          >
            浏览全部文献
          </TurboLink>
          <TurboLink
            href="/subscribe"
            className={buttonVariants({
              variant: "outline",
              className:
                "!border-white/50 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white focus-visible:!text-white",
            })}
          >
            订阅每日更新
          </TurboLink>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
            Search intent
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
            这个主题解决什么搜索问题？
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
            {topic.intent}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {topic.searchKeywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border border-[#2d5a87]/20 bg-[#2d5a87]/8 px-3 py-1 text-xs font-medium text-[#1e3a5f] dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
            Action ladder
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
            先做这几步
          </h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-slate-700 dark:text-slate-200">
            {topic.interventions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      {topic.slug === "prediabetes" ? (
        <section className="mt-10" id="ogtt-analyzer">
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
              OGTT report analyzer
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
              上传报告，一键解读 OGTT 指标
            </h2>
            <p className="mt-3 text-base leading-8 text-slate-600 dark:text-slate-300">
              自动识别空腹与服糖后血糖、胰岛素和
              HbA1c，先提示需要人工校对的字段，再给出风险分层与生活方式行动方案。
            </p>
          </div>
          <OgttAnalyzer />
        </section>
      ) : null}

      {topic.slug === "diet" ? (
        <>
          <section className="mt-10" id="food-analyzer">
            <div className="mb-6 max-w-3xl">
              <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
                AI meal analyzer
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
                拍下这一餐，获得糖前期饮食建议
              </h2>
              <p className="mt-3 text-base leading-8 text-slate-600 dark:text-slate-300">
                AI
                识别餐盘中的食物和目测份量，分析碳水质量、蛋白质、蔬菜与纤维搭配，并给出下一餐可以直接执行的调整建议。
              </p>
            </div>
            <FoodAnalyzer />
          </section>
          <section className="mt-10" id="diet-lifestyle-tracker">
            <div className="mb-6 max-w-3xl">
              <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
                Daily context tracker
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
                把饮食、睡眠与运动放在同一条时间线上
              </h2>
              <p className="mt-3 text-base leading-8 text-slate-600 dark:text-slate-300">
                记录恢复状态与活动信息，避免只根据一顿饭或单日血糖下结论。
              </p>
            </div>
            <LifestyleTracker focus="diet" />
          </section>
        </>
      ) : null}

      {topic.slug === "exercise-sleep" ? (
        <section className="mt-10" id="lifestyle-tracker">
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
              Sleep & movement tracker
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
              记录睡眠与运动，获得连续趋势分析
            </h2>
            <p className="mt-3 text-base leading-8 text-slate-600 dark:text-slate-300">
              综合睡眠、精力、压力、有氧、饭后活动和抗阻训练，给出连续趋势判断与可执行建议。
            </p>
          </div>
          <LifestyleTracker />
        </section>
      ) : null}

      {topic.slug === "stress-emotion" ? (
        <section className="mt-10" id="companion-coach">
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
              DPP behavior companion
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
              难受时有人接住，偏离后还能重新开始
            </h2>
            <p className="mt-3 text-base leading-8 text-slate-600 dark:text-slate-300">
              面向长期生活方式改变过程中的疲惫、渴望、平台期和自我怀疑，提供每日签到、即时陪伴、重新开始计划与每周复盘。
            </p>
          </div>
          <CompanionCoach />
        </section>
      ) : null}

      <section className="mt-10">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
              Cluster articles
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
              这个主题下的研究解读
            </h2>
          </div>
          <TurboLink
            href="/articles"
            className="text-sm font-semibold text-[#1e3a5f] underline-offset-4 hover:underline dark:text-sky-200"
          >
            查看全部文章
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
              这个主题正在积累文章
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              相关研究正在持续整理中，你可以先查看行动清单或浏览其他主题。
            </p>
          </div>
        )}
      </section>

      <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
          Related topics
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
          继续学习相关主题
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {siblingTopics.map((item) => (
            <TurboLink
              key={item.slug}
              href={`/guide/${item.slug}`}
              className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-950 transition hover:-translate-y-1 hover:border-[#2d5a87]/40 hover:text-[#1e3a5f] dark:border-slate-800 dark:text-white"
            >
              {item.title}
              <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                {item.kicker}
              </span>
            </TurboLink>
          ))}
        </div>
      </section>
    </main>
  );
}
