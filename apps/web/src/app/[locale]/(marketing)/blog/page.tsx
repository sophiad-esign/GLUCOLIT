import { redirect } from "next/navigation";

import { pathsConfig } from "~/config/paths";

export default function BlogPage() {
  redirect(pathsConfig.marketing.articles.index);
}
