import { redirect } from "next/navigation";

import { pathsConfig } from "~/config/paths";

export default function AdminPage() {
  redirect(pathsConfig.admin.drafts.index);
}
