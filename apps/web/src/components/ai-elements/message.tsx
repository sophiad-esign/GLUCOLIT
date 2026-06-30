"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@workspace/ui";

import type { ComponentProps } from "react";

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
      {...props}
    />
  ),
  (previous, next) =>
    previous.children === next.children &&
    previous.isAnimating === next.isAnimating,
);

MessageResponse.displayName = "MessageResponse";
