"use client";

import dynamic from "next/dynamic";
import { posthog } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

import { env } from "./env";

import type { AnalyticsProviderClientStrategy } from "@workspace/analytics";

const PageView = dynamic(
  () => import("./page-view").then((mod) => mod.PageView),
  {
    ssr: false,
  },
);

const isPostHogEnabled = Boolean(env.NEXT_PUBLIC_POSTHOG_KEY);

if (typeof window !== "undefined" && isPostHogEnabled && !posthog.__loaded) {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: "always",
    capture_pageview: false,
    disable_external_dependency_loading: true,
    disable_session_recording: true,
  });
}

export const strategy = {
  Provider: ({ children }) => {
    if (!isPostHogEnabled) {
      return children;
    }

    return (
      <PostHogProvider client={posthog}>
        {children}
        <PageView />
      </PostHogProvider>
    );
  },
  track: (event, properties) => {
    if (typeof window === "undefined" || !isPostHogEnabled) {
      return;
    }

    posthog.capture(event, properties);
  },
  identify: (userId, traits) => {
    if (typeof window === "undefined" || !isPostHogEnabled) {
      return;
    }

    posthog.identify(userId, traits);
  },
  reset: () => {
    if (typeof window === "undefined" || !isPostHogEnabled) {
      return;
    }

    posthog.reset();
  },
} satisfies AnalyticsProviderClientStrategy;
