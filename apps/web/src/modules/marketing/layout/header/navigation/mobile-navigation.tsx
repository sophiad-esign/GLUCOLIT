import { useState } from "react";

import { cn } from "@workspace/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui-web/accordion";
import { buttonVariants } from "@workspace/ui-web/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@workspace/ui-web/navigation-menu";
import { Sheet, SheetContent, SheetTrigger } from "@workspace/ui-web/sheet";

import { TurboLink } from "~/modules/common/turbo-link";

import { Hamburger } from "./hamburger";
import { Item } from "./navigation";

import type { NavigationProps } from "./types";

export const MobileNavigation = ({ links }: NavigationProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={(props, state) => (
          <Hamburger open={state.open} className="lg:hidden" {...props} />
        )}
      />
      <SheetContent
        side="top"
        showCloseButton={false}
        className="z-30 rounded-b-md px-[1.7rem] pb-6 data-[side=top]:top-14 sm:px-8"
        overlay={{ className: "top-14 z-30" }}
      >
        <NavigationMenu className="w-full max-w-full py-2 [&>div]:w-full">
          <NavigationMenuList className="-mx-4 flex-col space-y-1">
            {links.map((link) => (
              <NavigationMenuItem key={link.label} className="w-full">
                {"items" in link ? (
                  <Accordion>
                    <AccordionItem value="item-1">
                      <AccordionTrigger
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "justify-between text-base font-medium hover:no-underline",
                        )}
                      >
                        {link.label}
                      </AccordionTrigger>
                      <AccordionContent className="py-2 [&_a]:no-underline">
                        <ul className="flex flex-col">
                          {link.items.map((item) => (
                            <Item
                              key={item.title}
                              {...item}
                              onClick={() => setOpen(false)}
                            />
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : (
                  <TurboLink
                    href={link.href}
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "w-full justify-start text-base font-medium",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </TurboLink>
                )}
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <TurboLink
          href="/subscribe"
          className={buttonVariants({
            className: "w-full bg-[#1e3a5f] hover:bg-[#2d5a87]",
          })}
          onClick={() => setOpen(false)}
        >
          {/* oxlint-disable-next-line i18next/no-literal-string */}
          订阅每日更新
        </TurboLink>
      </SheetContent>
    </Sheet>
  );
};
