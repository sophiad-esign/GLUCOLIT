import { reviewArticlesManifest } from "./review-manifest.generated";

import type { Article } from "./data";

const toArticle = (item: (typeof reviewArticlesManifest)[number]): Article => ({
  ...item,
  publishedAt: new Date(item.publishedAt),
});

export const getReviewArticlesFromFiles = () =>
  reviewArticlesManifest
    .map(toArticle)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

export const getReviewArticleFromFileBySlug = (slug: string) =>
  getReviewArticlesFromFiles().find((article) => article.slug === slug) ?? null;
