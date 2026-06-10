"use client";

import { useFormStatus } from "react-dom";

import type { ReactNode } from "react";

type SubmitActionButtonProps = {
  children: ReactNode;
  className: string;
  disabled?: boolean;
  pendingText: string;
};

export function SubmitActionButton({
  children,
  className,
  disabled,
  pendingText,
}: SubmitActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={className}
      aria-live="polite"
    >
      {pending ? pendingText : children}
    </button>
  );
}
