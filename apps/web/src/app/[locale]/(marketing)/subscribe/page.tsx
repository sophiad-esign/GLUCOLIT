/* eslint-disable i18next/no-literal-string */

import { buttonVariants } from "@workspace/ui-web/button";
import { Input } from "@workspace/ui-web/input";

import { pathsConfig } from "~/config/paths";
import { TurboLink } from "~/modules/common/turbo-link";

export const metadata = {
  title: "订阅 GLUCOLIT",
  description: "订阅糖尿病前期与代谢健康每日文献更新。",
};

export default function SubscribePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[1fr_420px] dark:border-slate-800 dark:bg-slate-950">
        <div className="p-8 sm:p-10">
          <p className="text-sm font-semibold tracking-[0.18em] text-[#2d5a87] uppercase">
            Daily briefing
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-normal text-slate-950 dark:text-white">
            订阅每日文献更新
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
            每天收到糖尿病前期、胰岛素抵抗、饮食、运动、睡眠、压力、补充剂和 CGM
            相关的高质量研究线索。邮件功能会在下一阶段接入后端。
          </p>

          <form className="mt-8 grid gap-4">
            <label
              htmlFor="subscriber-name"
              className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              你的称呼
              <Input id="subscriber-name" placeholder="例如 Sophia" />
            </label>
            <label
              htmlFor="subscriber-email"
              className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              邮箱
              <Input
                id="subscriber-email"
                type="email"
                placeholder="your@email.com"
              />
            </label>
            <button
              type="button"
              className={buttonVariants({
                className: "w-fit bg-[#1e3a5f] hover:bg-[#2d5a87]",
              })}
            >
              订阅更新
            </button>
          </form>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <TurboLink
              href={pathsConfig.auth.register}
              className="font-semibold text-[#1e3a5f] underline-offset-4 hover:underline dark:text-sky-200"
            >
              注册账号
            </TurboLink>
            <TurboLink
              href={pathsConfig.auth.login}
              className="font-semibold text-[#1e3a5f] underline-offset-4 hover:underline dark:text-sky-200"
            >
              登录
            </TurboLink>
          </div>
        </div>

        <aside className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] p-8 text-white sm:p-10">
          <h2 className="text-2xl font-bold tracking-normal">你会收到什么？</h2>
          <ul className="mt-6 list-disc space-y-4 pl-5 text-sm leading-7 text-sky-50">
            <li>每天最多 2 篇候选研究的人工审核草稿。</li>
            <li>干预指南式摘要：结论、评分、行动清单和 Research Primer。</li>
            <li>原文 DOI、PubMed 或开放获取链接，方便继续核查。</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
