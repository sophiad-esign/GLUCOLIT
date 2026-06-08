/* eslint-disable i18next/no-literal-string */

import { buttonVariants } from "@workspace/ui-web/button";

import { TurboLink } from "~/modules/common/turbo-link";

export const metadata = {
  title: "糖前指南 | GLUCOLIT",
  description: "糖尿病前期读者的饮食、运动、睡眠、压力和监测入门指南。",
};

const sections = [
  {
    title: "Diet 饮食",
    body: "先把主食、蛋白质、蔬菜和含糖饮料看清楚。多数人不需要一开始就极端低碳，先减少液体糖和精制碳水更现实。",
  },
  {
    title: "Exercise 运动",
    body: "从饭后步行开始，每周累计 150 分钟中等强度运动，再逐步加入抗阻训练。",
  },
  {
    title: "Sleep 睡眠",
    body: "睡眠不足会影响食欲、胰岛素敏感性和第二天的血糖波动。先固定起床时间，再优化入睡环境。",
  },
  {
    title: "Stress 压力",
    body: "长期压力会推高皮质醇和进食冲动。压力管理不是玄学，而是代谢健康干预的一部分。",
  },
  {
    title: "Supplements 补充剂",
    body: "补充剂只能作为辅助，不能替代饮食、运动和医生建议。优先看证据等级、剂量、安全性和相互作用。",
  },
  {
    title: "CGM 动态血糖",
    body: "CGM 的价值不是制造焦虑，而是帮助你发现哪些食物、作息和运动真正影响自己的餐后血糖。",
  },
];

export default function GuidePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] px-6 py-10 text-white sm:px-10">
        <p className="text-sm font-semibold tracking-[0.18em] text-sky-100 uppercase">
          Prediabetes playbook
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-normal">
          糖尿病前期行动指南
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-sky-50">
          这里不是一次性给你一堆口号，而是把糖前干预拆成饮食、运动、睡眠、压力、补充剂和血糖监测六条可执行路径。
        </p>
      </section>

      <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950"
          >
            <h2 className="text-xl font-bold tracking-normal text-slate-950 dark:text-white">
              {section.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {section.body}
            </p>
          </article>
        ))}
      </section>

      <div className="mt-10">
        <TurboLink
          href="/articles"
          className={buttonVariants({
            className: "bg-[#1e3a5f] hover:bg-[#2d5a87]",
          })}
        >
          查看干预指南库
        </TurboLink>
      </div>
    </main>
  );
}
