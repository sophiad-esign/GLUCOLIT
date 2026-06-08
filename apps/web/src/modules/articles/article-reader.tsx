"use client";

/* eslint-disable i18next/no-literal-string */

import { useState } from "react";

import { Button } from "@workspace/ui-web/button";

import { readingBlocks } from "./reading-blocks";

import type { Article } from "./data";

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

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl space-y-5 text-slate-800 dark:text-slate-100">
          <h2 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-white">
            {isChinese ? "原文精华摘要" : "English Plain-Language Version"}
          </h2>
          {readingBlocks(body).map((block, index) =>
            block.type === "list" ? (
              <ul
                key={`list-${index}`}
                className="list-disc space-y-2 pl-6 text-[17px] leading-8"
              >
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p
                key={`${block.text}-${index}`}
                className="text-[17px] leading-8 sm:leading-9"
              >
                {block.text}
              </p>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
