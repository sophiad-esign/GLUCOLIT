import { redirect } from "next/navigation";

import { pathsConfig } from "~/config/paths";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  redirect(pathsConfig.marketing.articles.article((await params).slug));
}
