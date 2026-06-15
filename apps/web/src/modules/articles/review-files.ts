import { reviewArticlesManifest } from "./review-manifest.generated";

import type { Article } from "./data";

const toArticle = (item: (typeof reviewArticlesManifest)[number]): Article => ({
  ...item,
  publishedAt: new Date(item.publishedAt),
  authors: "GLUCOLIT 编辑部",
  referenceTitle: item.titleEn || item.titleZh,
  referenceLinks: [
    ...(item.doi
      ? [{ label: "DOI", href: `https://doi.org/${item.doi}` }]
      : []),
    ...(item.originalUrl
      ? [{ label: "原文链接", href: item.originalUrl }]
      : []),
  ],
  evidenceLabel: item.categoryLabels.includes("医学研究") ? "文献" : "指南",
  reviewStatusLabel: item.reviewRequired ? "需复核" : "可发布",
});

export const getReviewArticlesFromFiles = () =>
  reviewArticlesManifest
    .map(toArticle)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

export const getReviewArticleFromFileBySlug = (slug: string) =>
  getReviewArticlesFromFiles().find((article) => article.slug === slug) ?? null;
