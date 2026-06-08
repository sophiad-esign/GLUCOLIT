"use client";

import { buttonVariants } from "@workspace/ui-web/button";
import { Icons } from "@workspace/ui-web/icons";

import { pathsConfig } from "~/config/paths";
import { ThemeControls } from "~/modules/common/theme";
import { TurboLink } from "~/modules/common/turbo-link";

import { MobileNavigation } from "./navigation/mobile-navigation";
import { Navigation } from "./navigation/navigation";

const links = [
  {
    label: "首页",
    href: pathsConfig.index,
  },
  {
    label: "干预指南",
    href: pathsConfig.marketing.articles.index,
  },
  {
    label: "糖前指南",
    href: "/guide",
  },
  {
    label: "关于 GLUCOLIT",
    href: "/about",
  },
] as const;

export const Header = () => {
  return (
    <header className="bg-background/90 sticky inset-0 top-(--banner-height,0px) z-40 w-full border-b py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 pr-4 sm:container">
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

        <Navigation links={links} />

        <div className="flex items-center justify-center lg:gap-2">
          <ThemeControls />
          <TurboLink
            href="/subscribe"
            className={buttonVariants({
              className:
                "hidden bg-[#1e3a5f] hover:bg-[#2d5a87] lg:inline-flex",
            })}
          >
            {/* oxlint-disable-next-line i18next/no-literal-string */}
            订阅
          </TurboLink>
          <MobileNavigation links={links} />
        </div>
      </div>
    </header>
  );
};
