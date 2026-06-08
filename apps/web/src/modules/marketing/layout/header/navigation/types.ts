import type { Icon } from "@workspace/ui-web/icons";

export type NavigationLink =
  | {
      readonly label: string;
      readonly href: string;
    }
  | {
      readonly label: string;
      readonly items: NavigationLinkItem[] | readonly NavigationLinkItem[];
    };

export interface NavigationLinkItem {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly icon: Icon;
}

export interface NavigationProps {
  readonly links: NavigationLink[] | readonly NavigationLink[];
}
