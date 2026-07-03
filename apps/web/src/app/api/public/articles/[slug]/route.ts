import { NextResponse } from "next/server";

import { getPublishedArticleBySlug } from "~/modules/articles/data";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const article = getPublishedArticleBySlug(slug);
  if (!article) {
    return NextResponse.json(
      { error: "文章不存在或尚未发布。" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    article: {
      slug: article.slug,
      title: article.titleZh,
      summary: article.summaryZh,
      body: article.bodyZh,
      source: article.source,
      authors: article.authors,
      publishedAt: article.publishedAtLabel,
      referenceLinks: article.referenceLinks,
      topic: article.topic,
      tags: article.tags,
    },
  });
};
