import { NextResponse } from "next/server";

import { TOPIC_CLUSTERS } from "~/modules/articles/data";

export const dynamic = "force-static";

export const GET = () =>
  NextResponse.json({
    topics: TOPIC_CLUSTERS.map(({ slug, title, kicker, description }) => ({
      slug,
      title,
      kicker,
      description,
    })),
  });
