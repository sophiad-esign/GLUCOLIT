/* eslint-disable i18next/no-literal-string */

import { buttonVariants } from "@workspace/ui-web/button";

import { TOPIC_CLUSTERS } from "~/modules/articles/data";
import { TurboLink } from "~/modules/common/turbo-link";

export const metadata = {
  title: "糖前指南 | GLUCOLIT",
  description: "糖尿病前期读者的饮食、运动、睡眠、压力和监测入门指南。",
};

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
        {TOPIC_CLUSTERS.map((section) => (
          <TurboLink
            key={section.slug}
            href={`/guide/${section.slug}`}
            className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-950"
          >
            <p className="text-xs font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
              {section.kicker}
            </p>
            <h2 className="mt-3 text-xl font-bold tracking-normal text-slate-950 group-hover:text-[#1e3a5f] dark:text-white">
              {section.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {section.description}
            </p>
            <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {section.interventions.slice(0, 2).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </TurboLink>
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
