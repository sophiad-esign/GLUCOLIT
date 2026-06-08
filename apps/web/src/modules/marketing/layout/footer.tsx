/* eslint-disable i18next/no-literal-string */

import { Icons } from "@workspace/ui-web/icons";

import { pathsConfig } from "~/config/paths";
import { I18nControls } from "~/modules/common/i18n/controls";
import { TurboLink } from "~/modules/common/turbo-link";

const columns = [
  {
    title: "站点",
    links: [
      { title: "首页", href: pathsConfig.index },
      { title: "干预指南", href: pathsConfig.marketing.articles.index },
      { title: "糖前指南", href: "/guide" },
      { title: "关于 GLUCOLIT", href: "/about" },
    ],
  },
  {
    title: "读者服务",
    links: [
      { title: "订阅每日更新", href: "/subscribe" },
      { title: "后台草稿审核", href: pathsConfig.admin.drafts.index },
      { title: "公开文章", href: pathsConfig.marketing.articles.index },
    ],
  },
] as const;

export const Footer = async () => {
  return (
    <footer className="mt-auto w-full border-t bg-slate-50 px-6 pt-10 pb-8 dark:bg-slate-950">
      <div className="sm:container">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <TurboLink
              href={pathsConfig.index}
              className="flex shrink-0 items-center gap-3"
              aria-label="GLUCOLIT 首页"
            >
              <Icons.Logo className="text-primary h-8" />
              <span className="text-xl font-bold tracking-normal text-slate-950 dark:text-white">
                GLUCOLIT
              </span>
            </TurboLink>

            <div className="mt-5 grid gap-4 text-sm leading-7 text-slate-600 md:grid-cols-3 dark:text-slate-300">
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">
                  数据源声明
                </p>
                <p>
                  优先追踪 PubMed、PubMed Central、Europe PMC、Unpaywall
                  与开放获取期刊链接。
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">
                  审核流程说明
                </p>
                <p>
                  自动生成内容先进入草稿库，人工检查事实边界、版权风险和可读性后再发布。
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">
                  免责声明
                </p>
                <p>
                  本站内容仅供科普参考，不构成医疗建议。如有健康问题，请咨询专业医生。
                </p>
              </div>
            </div>

            <div className="mt-5">
              <I18nControls />
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            {columns.map((column) => (
              <div className="flex w-full flex-col gap-4" key={column.title}>
                <span className="text-foreground text-sm font-medium">
                  {column.title}
                </span>
                <nav>
                  <ul className="flex flex-col gap-2">
                    {column.links.map((link) => (
                      <li key={link.title}>
                        <TurboLink
                          href={link.href}
                          className="text-muted-foreground hover:text-foreground relative text-sm transition-colors"
                        >
                          {link.title}
                        </TurboLink>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t pt-6">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} GLUCOLIT.
            基于公开学术文献进行第三方评论，不代表原文作者及出版机构立场。
          </p>
        </div>
      </div>
    </footer>
  );
};
