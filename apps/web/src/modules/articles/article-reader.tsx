"use client";

/* eslint-disable i18next/no-literal-string */

import { useState } from "react";

import { Button } from "@workspace/ui-web/button";

import type { Article } from "./data";

const paragraphs = (content: string) =>
  content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export function ArticleReader({ article }: { article: Article }) {
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const isChinese = language === "zh";
  const body = isChinese ? article.bodyZh : article.bodyEn;

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <Button
            type="button"
            size="sm"
            variant={isChinese ? "default" : "ghost"}
            className={isChinese ? "rounded-full bg-[#1e3a5f]" : "rounded-full"}
            onClick={() => setLanguage("zh")}
          >
            中文
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!isChinese ? "default" : "ghost"}
            className={
              !isChinese ? "rounded-full bg-[#1e3a5f]" : "rounded-full"
            }
            onClick={() => setLanguage("en")}
          >
            English
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {paragraphs(body).map((paragraph) => (
            <p key={paragraph} className="text-base leading-[1.8]">
              {paragraph.replace(/^[-*]\s+/, "")}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
