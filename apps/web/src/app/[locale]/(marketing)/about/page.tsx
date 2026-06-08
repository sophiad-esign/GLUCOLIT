/* eslint-disable i18next/no-literal-string */

export const metadata = {
  title: "关于 GLUCOLIT",
  description: "GLUCOLIT 的定位、数据源、审核流程和医学免责声明。",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p className="text-sm font-semibold tracking-[0.18em] text-[#2d5a87] uppercase">
          About GLUCOLIT
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-normal text-slate-950 dark:text-white">
          关于 GLUCOLIT
        </h1>
        <div className="mt-6 space-y-5 text-base leading-8 text-slate-600 dark:text-slate-300">
          <p>
            GLUCOLIT
            是一个面向糖尿病前期、胰岛素抵抗和代谢健康读者的医学科普独立站。我们追踪公开学术文献，把研究转化成更容易判断和执行的干预指南。
          </p>
          <p>
            作者背景：公共营养师三级，一堂 6
            年会员，长期关注营养干预、代谢健康和个人健康数据工具。本站写作目标不是替代医生，而是帮助普通读者更好地读懂研究、提出问题、和专业人士沟通。
          </p>
          <p>
            网站优先使用 PubMed、PubMed Central、Europe PMC、Unpaywall
            和开放获取论文链接。自动生成内容不会直接发布，必须经过人工审核。
          </p>
          <p>
            审核机制包括：原文来源核查、证据等级判断、版权风险检查、因果边界检查、中文可读性检查，以及是否能转化为可执行行动清单。
          </p>
          <p>
            本站内容仅供科普参考，不构成诊断、治疗或用药建议。如果你已经确诊糖尿病、正在用药、怀孕或有低血糖风险，请优先咨询专业医生。
          </p>
        </div>
      </section>
    </main>
  );
}
