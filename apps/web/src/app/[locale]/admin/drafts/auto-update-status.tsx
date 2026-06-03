/* eslint-disable i18next/no-literal-string */

import { Badge } from "@workspace/ui-web/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui-web/card";
import { Icons } from "@workspace/ui-web/icons";

const feeds = [
  "Lancet Diabetes & Endocrinology",
  "Nature Metabolism",
  "Diabetes Care (ADA)",
  "PubMed prediabetes",
];

export function AutoUpdateStatus({ canPublish }: { canPublish: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icons.ClockFading className="size-5 text-[#1e3a5f]" />
              Daily literature update
            </CardTitle>
            <CardDescription>
              GitHub Actions fetches research feeds every day, creates review
              drafts, and commits them back to GitHub.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            Daily 09:15 Los Angeles, max 2 drafts
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
          <div className="text-sm font-semibold">Workflow</div>
          <p className="text-muted-foreground mt-2 text-sm leading-7">
            .github/workflows/glucolit-rss-monitor.yml
          </p>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
          <div className="text-sm font-semibold">Safety rule</div>
          <p className="text-muted-foreground mt-2 text-sm leading-7">
            New posts are always generated as draft: true, with a daily cap of 2
            new drafts. They only become public after manual review and
            one-click publishing.
          </p>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
          <div className="text-sm font-semibold">Publish button</div>
          <p className="text-muted-foreground mt-2 text-sm leading-7">
            {canPublish
              ? "GitHub write token is configured. One-click publish is enabled."
              : "GITHUB_CONTENT_TOKEN is missing. One-click publish is disabled."}
          </p>
        </div>

        <div className="rounded-xl border p-4 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Icons.BookOpen className="size-4" />
            Research sources
          </div>
          <div className="flex flex-wrap gap-2">
            {feeds.map((feed) => (
              <Badge key={feed} variant="outline">
                {feed}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
