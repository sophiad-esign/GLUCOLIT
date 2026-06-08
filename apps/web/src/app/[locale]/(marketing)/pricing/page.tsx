import { redirect } from "next/navigation";

import { pathsConfig } from "~/config/paths";

export default function PricingPage() {
  redirect(pathsConfig.marketing.articles.index);
}
