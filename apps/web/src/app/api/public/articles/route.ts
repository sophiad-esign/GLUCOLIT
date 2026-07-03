import { NextResponse } from "next/server";

import {
  getPublishedArticles,
  getTopicClusterArticles,
} from "~/modules/articles/data";

const toCard = (article: ReturnType<typeof getPublishedArticles>[number]) => ({
  slug: article.slug,
  title: article.titleZh,
  summary: article.summaryZh,
  thumbnail: article.thumbnail,
  source: article.source,
  publishedAt: article.publishedAtLabel,
  topic: article.topic,
  tags: article.tags,
});

export const GET = (request: Request) => {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic")?.trim();
  const cursor = Math.max(0, Number(searchParams.get("cursor")) || 0);
  const limit = Math.min(
    20,
    Math.max(1, Number(searchParams.get("limit")) || 10),
  );
  const articles = topic
    ? getTopicClusterArticles(topic)
    : getPublishedArticles();
  const page = articles.slice(cursor, cursor + limit);

  return NextResponse.json({
    articles: page.map(toCard),
    nextCursor:
      cursor + page.length < articles.length ? cursor + page.length : null,
  });
};
