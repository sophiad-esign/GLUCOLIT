/* eslint-disable i18next/no-literal-string */

import { Icons } from "@workspace/ui-web/icons";

import { pathsConfig } from "~/config/paths";
import { TurboLink } from "~/modules/common/turbo-link";

const links = [
  {
    href: pathsConfig.admin.drafts.index,
    label: "草稿审核",
    icon: Icons.ClockFading,
  },
  {
    href: pathsConfig.admin.articles.index,
    label: "文章总览",
    icon: Icons.BookOpen,
  },
  {
    href: pathsConfig.marketing.articles.index,
    label: "公开文章",
    icon: Icons.ArrowUpRight,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="border-b bg-white/90 backdrop-blur dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <TurboLink
            href={pathsConfig.admin.drafts.index}
            className="flex items-center gap-3"
          >
            <Icons.Logo className="text-primary size-9" />
            <div>
              <div className="text-lg font-bold tracking-normal">
                GLUCOLIT 后台
              </div>
              <div className="text-muted-foreground text-xs">
                文章草稿审核与发布
              </div>
            </div>
          </TurboLink>

          <nav className="flex flex-wrap gap-2">
            {links.map((link) => {
              const Icon = link.icon;

              return (
                <TurboLink
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900"
                >
                  <Icon className="size-4" />
                  {link.label}
                </TurboLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
