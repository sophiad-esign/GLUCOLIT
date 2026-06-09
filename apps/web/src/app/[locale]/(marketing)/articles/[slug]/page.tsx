/* eslint-disable i18next/no-literal-string */

import { notFound } from "next/navigation";

import { buttonVariants } from "@workspace/ui-web/button";

import { pathsConfig } from "~/config/paths";
import { ArticleCard } from "~/modules/articles/article-card";
import { ArticleReader } from "~/modules/articles/article-reader";
import {
  getAllPublishedArticleSlugs,
  getPrimaryTopicCluster,
  getPublishedArticleBySlug,
  getRelatedPublishedArticles,
} from "~/modules/articles/data";
import { TurboLink } from "~/modules/common/turbo-link";

import type { Article } from "~/modules/articles/data";

const scoreItems = (article: Article) => {
  const isMeta = /meta|systematic|review|analysis|trial|random/i.test(
    `${article.referenceTitle} ${article.summaryEn}`,
  );
  const hasLifestyle = article.categoryLabels.includes("生活方式");
  const hasCgm = article.categoryLabels.includes("CGM");

  return [
    {
      emoji: "🧪",
      label: "证据强度",
      value: isMeta ? 4 : 3,
      hint: isMeta ? "系统综述/RCT 优先" : "需结合原文核查",
    },
    {
      emoji: "🩺",
      label: "临床可行性",
      value: hasLifestyle ? 4 : 3,
      hint: hasLifestyle ? "适合先从生活方式做起" : "建议和医生讨论",
    },
    {
      emoji: "💰",
      label: "执行成本",
      value: hasCgm ? 2 : 4,
      hint: hasCgm ? "可能需要设备成本" : "多数人可低成本尝试",
    },
    {
      emoji: "🇨🇳",
      label: "中文本土化",
      value: 3,
      hint: "需按中国饮食和就医条件调整",
    },
  ];
};

const oneLineConclusion = (article: Article) =>
  (
    article.summaryZh.split(/[。！？!?]/)[0] ||
    "这篇指南帮助你判断一个代谢健康干预是否值得尝试"
  ).slice(0, 30);

const actionChecklist = (article: Article) => {
  const text = `${article.titleZh} ${article.summaryZh} ${article.categoryLabels.join(" ")}`;
  const actions = [
    "先确认自己的基线：空腹血糖、HbA1c、腰围、体重和近期饮食运动习惯。",
    "把目标写小：先追踪 2 周，再决定是否升级到更严格的干预。",
    "如果正在用药、怀孕、低血糖风险高或已有慢病，请先和医生确认。",
  ];

  if (/运动|exercise|activity/i.test(text)) {
    actions.unshift(
      "每周累计 150 分钟中等强度运动，从饭后 10-20 分钟步行开始。",
    );
  }
  if (/饮食|nutrition|diet|weight|magnesium|镁/i.test(text)) {
    actions.unshift(
      "先优化三餐结构：足量蛋白质、更多膳食纤维，减少含糖饮料和精制主食。",
    );
  }
  if (/cgm|连续血糖|动态血糖/i.test(text)) {
    actions.unshift(
      "用 CGM 或规律指尖血糖记录观察餐后峰值，而不是只盯单次空腹血糖。",
    );
  }

  return Array.from(new Set(actions)).slice(0, 5);
};

const insightChecklist = (article: Article) => [
  `先看证据等级：这篇内容当前归类为「${article.evidenceLabel}」，不要把它当成所有人的标准答案。`,
  "把建议翻译成自己的生活实验：一次只改一个变量，连续记录 2-4 周。",
  "关注趋势，不迷信单点数字：腰围、体重、餐后血糖和睡眠质量要一起看。",
  "如果方案涉及药物、补充剂或极端饮食，先确认禁忌证和相互作用。",
];

const faqItems = (article: Article) => [
  {
    question: "这篇指南能直接当作医疗建议吗？",
    answer:
      "不能。它是基于公开研究的第三方科普评论，适合帮助你理解方向，但具体诊断、用药和治疗需要医生判断。",
  },
  {
    question: "我应该先做哪一步？",
    answer:
      "先确认自己的基线指标，再选择一个最容易执行的生活方式动作，例如减少含糖饮料、饭后步行或记录餐后血糖。",
  },
  {
    question: "为什么同一类研究会有不同结论？",
    answer:
      "研究人群、干预时长、执行强度、饮食背景和测量指标都可能不同，所以 GLUCOLIT 会保留证据边界。",
  },
  {
    question: "如何核查原文？",
    answer: article.doi
      ? `可以点击 DOI ${article.doi} 或 PubMed 链接查看原始论文信息。`
      : "可以点击页面底部的 PubMed、DOI 或原文链接查看原始论文信息。",
  },
];

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isEnglish = locale === "en";
  const article = getPublishedArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = getRelatedPublishedArticles(article, 3);
  const primaryTopic = getPrimaryTopicCluster(article);
  const scores = scoreItems(article);
  const checklist = actionChecklist(article);
  const title = isEnglish ? article.titleEn : article.titleZh;
  const subtitle = isEnglish ? article.titleZh : article.titleEn;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <article>
        <header className="rounded-2xl border border-[#2d5a87]/20 bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] px-6 py-10 text-white shadow-sm sm:px-10">
          <div className="max-w-4xl">
            <div className="mb-5 flex flex-wrap gap-2">
              {article.categoryLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white"
                >
                  {label}
                </span>
              ))}
            </div>
            <h1 className="text-3xl leading-tight font-bold tracking-normal sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-base leading-7 text-sky-100">{subtitle}</p>

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
              ) : null}
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <strong>免责声明：</strong>
          本文是基于公开学术文献的第三方科普评论，不构成诊断、治疗或用药建议。若你已经确诊糖尿病、正在用药、怀孕或有低血糖风险，请先咨询专业医生。
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-4 md:grid-cols-4">
            {scores.map((score) => (
              <div
                key={score.label}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <span aria-hidden>{score.emoji}</span>
                  <span>{score.label}</span>
                </div>
                <div
                  className="mt-3 flex gap-1"
                  aria-label={`${score.label} ${score.value}/5`}
                >
                  {Array.from({ length: 5 }, (_, index) => (
                    <span
                      key={index}
                      className={
                        index < score.value
                          ? "h-2 flex-1 rounded-full bg-[#2d5a87]"
                          : "h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700"
                      }
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {score.hint}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[#2d5a87]/20 bg-[#2d5a87]/8 p-6 shadow-sm dark:border-sky-300/20 dark:bg-sky-300/10">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase dark:text-sky-200">
                Topic cluster
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
                本文属于「{primaryTopic.title}」干预主题
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                {primaryTopic.description}
              </p>
            </div>
            <TurboLink
              href={`/guide/${primaryTopic.slug}`}
              className={buttonVariants({
                className: "bg-[#1e3a5f] hover:bg-[#2d5a87]",
              })}
            >
              查看主题支柱页
            </TurboLink>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
              Bottom line
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
              一句话结论
            </h2>
            <p className="mt-4 text-2xl leading-10 font-semibold text-slate-950 dark:text-white">
              {oneLineConclusion(article)}。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
              Action checklist
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
              怎么做
            </h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-slate-700 dark:text-slate-200">
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-bold tracking-normal text-slate-950 dark:text-white">
            作者与审核信息
          </h2>
          <div className="mt-4 grid gap-4 text-sm leading-7 text-slate-600 sm:grid-cols-3 dark:text-slate-300">
            <div>
              <p className="font-semibold text-slate-950 dark:text-white">
                原文作者
              </p>
              <p>{article.authors}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-950 dark:text-white">
                GLUCOLIT 解读
              </p>
              <p>医学科普写作流程 + 人工审核后发布</p>
            </div>
            <div>
              <p className="font-semibold text-slate-950 dark:text-white">
                阅读提醒
              </p>
              <p>本文为第三方科普评论，不构成医疗建议。</p>
            </div>
          </div>
        </section>

        <div className="mt-8">
          <ArticleReader
            article={article}
            initialLanguage={isEnglish ? "en" : "zh"}
          />
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
              解读与批判
            </h2>
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr>
                    <th className="w-32 bg-slate-50 p-4 font-semibold text-slate-950 dark:bg-slate-900 dark:text-white">
                      能相信什么
                    </th>
                    <td className="p-4 leading-7 text-slate-600 dark:text-slate-300">
                      这篇研究提供了一个有价值的方向，适合用来生成行动假设。
                    </td>
                  </tr>
                  <tr>
                    <th className="bg-slate-50 p-4 font-semibold text-slate-950 dark:bg-slate-900 dark:text-white">
                      不能夸大什么
                    </th>
                    <td className="p-4 leading-7 text-slate-600 dark:text-slate-300">
                      不能把相关性写成因果，也不能保证每个糖前读者都会得到同样结果。
                    </td>
                  </tr>
                  <tr>
                    <th className="bg-slate-50 p-4 font-semibold text-slate-950 dark:bg-slate-900 dark:text-white">
                      还缺什么
                    </th>
                    <td className="p-4 leading-7 text-slate-600 dark:text-slate-300">
                      仍需要更长随访、更大样本和更接近中国生活场景的验证。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
              临床与商业洞察
            </h2>
            <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-slate-700 dark:text-slate-200">
              {insightChecklist(article).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
            FAQ
          </h2>
          <div className="mt-5 space-y-3">
            {faqItems(article).map((item) => (
              <details
                key={item.question}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <summary className="cursor-pointer font-semibold text-slate-950 dark:text-white">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <details>
            <summary className="cursor-pointer text-xl font-bold tracking-normal text-slate-950 dark:text-white">
              Research Primer：研究引用与原文信息
            </summary>
            <div className="mt-5">
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                {article.referenceTitle}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {article.referenceLinks.map((link) => (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    {link.label}
                  </a>
                ))}
                <TurboLink
                  href={pathsConfig.marketing.articles.index}
                  className={buttonVariants({ variant: "outline" })}
                >
                  返回指南库
                </TurboLink>
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
                如需阅读原文，请点击链接获取完整内容。本站文章基于公开学术文献进行第三方评论，不代表原文作者及出版机构立场。如涉版权问题，请权利人联系下架。
              </p>
            </div>
          </details>
        </section>
      </article>

      {relatedArticles.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
            相关文章推荐
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            {relatedArticles.map((item) => (
              <ArticleCard key={item.slug} article={item} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

export function generateStaticParams() {
  return getAllPublishedArticleSlugs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const article = getPublishedArticleBySlug(slug);

  if (!article) {
    return {};
  }

  const isEnglish = locale === "en";

  return {
    title: isEnglish ? article.titleEn : article.titleZh,
    description: isEnglish ? article.summaryEn : article.summaryZh,
  };
}
