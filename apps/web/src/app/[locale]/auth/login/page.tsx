import { redirect } from "next/navigation";

import { pathsConfig } from "~/config/paths";
import { getMetadata } from "~/lib/metadata";

export const generateMetadata = getMetadata({
  title: "GLUCOLIT 后台",
});

export default function Login() {
  redirect(pathsConfig.admin.drafts.index);
}
