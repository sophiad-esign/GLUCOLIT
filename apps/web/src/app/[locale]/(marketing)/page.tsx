/* eslint-disable i18next/no-literal-string */

import { withI18n } from "@workspace/i18n/with-i18n";
import { Button } from "@workspace/ui-web/button";
import { Input } from "@workspace/ui-web/input";

import { pathsConfig } from "~/config/paths";
import { ArticleCard } from "~/modules/articles/article-card";
import { getPublishedArticles } from "~/modules/articles/data";
import { TurboLink } from "~/modules/common/turbo-link";

const HomePage = () => {
  const articles = getPublishedArticles({ limit: 3 });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] px-6 py-12 text-white shadow-xl sm:px-10 lg:px-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-sky-100 uppercase">
              Evidence-based Prediabetes Radar
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-normal sm:text-6xl">
              GLUCOLIT
            </h1>
            <p className="mt-4 text-xl font-medium text-sky-50">
              糖尿病前期权威科普雷达
            </p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-sky-100">
              每天追踪国际顶级期刊，把糖尿病前期、胰岛素抵抗与生活方式干预研究整理成普通人能读懂的中英文科普。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <TurboLink
                href={pathsConfig.marketing.articles.index}
                className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[#1e3a5f] shadow-sm transition hover:bg-sky-50"
              >
                查看文章库
              </TurboLink>
            </div>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur">
            <div className="mx-auto flex aspect-square max-w-72 items-center justify-center rounded-full bg-white/15">
              <svg
                viewBox="0 0 220 220"
                role="img"
                aria-label="Medical research illustration"
                className="h-52 w-52"
              >
                <circle cx="110" cy="110" r="86" fill="#e0f2fe" opacity="0.9" />
                <path
                  d="M74 61h72a14 14 0 0 1 14 14v70a14 14 0 0 1-14 14H74a14 14 0 0 1-14-14V75a14 14 0 0 1 14-14Z"
                  fill="#ffffff"
                />
                <path
                  d="M92 47h36v28H92zM80 98h60M80 121h44M80 144h72"
                  stroke="#1e3a5f"
                  strokeWidth="10"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M111 86v50M86 111h50"
                  stroke="#2d5a87"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-[#2d5a87] uppercase">
              Latest Articles
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
              最新已发布文章
            </h2>
          </div>
          <TurboLink
            href={pathsConfig.marketing.articles.index}
            className="text-sm font-semibold text-[#1e3a5f] hover:text-[#2d5a87] dark:text-sky-200"
          >
            查看全部
          </TurboLink>
        </div>

        {articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
              文章正在审核中
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              RSS 已能自动生成草稿。人工确认内容质量并把文章设为 draft: false
              后，最新文章会显示在这里。
            </p>
          </div>
        )}
      </section>

      <section className="mb-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
              订阅 GLUCOLIT 研究简报
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              每周收到糖尿病前期逆转、饮食运动干预和胰岛素抵抗研究的双语摘要。
            </p>
          </div>
          <form className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              placeholder="your@email.com"
              className="h-12"
              aria-label="Email address"
            />
            <Button
              type="button"
              className="h-12 bg-[#1e3a5f] hover:bg-[#2d5a87]"
            >
              订阅
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default withI18n(HomePage);
