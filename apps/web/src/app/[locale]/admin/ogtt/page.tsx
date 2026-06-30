/* eslint-disable i18next/no-literal-string */

import { Badge } from "@workspace/ui-web/badge";

import { api } from "~/lib/api/server";

const riskLabel: Record<string, string> = {
  normal: "暂未达到糖前范围",
  prediabetes: "糖前范围",
  "diabetes-range": "糖尿病诊断范围",
  "needs-review": "信息不足",
};

export const dynamic = "force-dynamic";

export default async function OgttAdminPage() {
  let analyses: Array<{
    id: string;
    createdAt: string;
    riskLevel: string;
    classification: string;
    confidence: number;
    needsManualReview: boolean;
    glucoseUnit: string;
    extractedMetrics: Record<string, unknown>;
  }> = [];
  let databaseReady = true;

  try {
    const response = await api.ai.ogtt.$get();

    if (!response.ok) {
      throw new Error("Unable to load OGTT analyses");
    }

    const payload = await response.json();
    analyses = payload.analyses.map((analysis) => ({
      ...analysis,
      createdAt: analysis.createdAt,
      extractedMetrics: analysis.extractedMetrics as Record<string, unknown>,
    }));
  } catch {
    databaseReady = false;
  }

  const reviewCount = analyses.filter(
    (analysis) => analysis.needsManualReview,
  ).length;
  const highCount = analyses.filter(
    (analysis) => analysis.riskLevel === "diabetes-range",
  ).length;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold tracking-[0.16em] text-[#2d5a87] uppercase">
          OGTT analysis operations
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-normal">
          OGTT 报告分析后台
        </h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-7">
          这里只保存脱敏后的结构化指标和分析摘要，不保存用户上传的原始体检报告截图。
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["累计分析", analyses.length],
          ["需要人工复核", reviewCount],
          ["达到糖尿病诊断范围", highCount],
        ].map(([label, value]) => (
          <div
            className="rounded-2xl border bg-white p-5 shadow-sm"
            key={label}
          >
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="mt-2 font-mono text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      {!databaseReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
          数据表尚未迁移。请先执行数据库迁移；前台分析仍可返回结果，但暂不会保存后台记录。
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">最近 100 条分析</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            建议优先抽查低置信度、单位不明确和达到糖尿病范围的记录。
          </p>
        </div>

        {analyses.length ? (
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">时间</th>
                    <th className="px-5 py-3 font-medium">风险分层</th>
                    <th className="px-5 py-3 font-medium">关键指标</th>
                    <th className="px-5 py-3 font-medium">置信度</th>
                    <th className="px-5 py-3 font-medium">隐私</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analyses.map((analysis) => {
                    const metrics = analysis.extractedMetrics as {
                      fastingGlucose?: number | null;
                      glucose120?: number | null;
                      hba1c?: number | null;
                    };

                    return (
                      <tr key={analysis.id} className="align-top">
                        <td className="px-5 py-4 font-mono text-xs">
                          {new Date(analysis.createdAt).toLocaleString("zh-CN")}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant="outline">
                            {riskLabel[analysis.riskLevel] ??
                              analysis.riskLevel}
                          </Badge>
                          <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                            {analysis.classification}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs leading-6">
                          空腹 {metrics.fastingGlucose ?? "—"} / 2h{" "}
                          {metrics.glucose120 ?? "—"} {analysis.glucoseUnit}
                          <br />
                          HbA1c {metrics.hba1c ?? "—"}%
                        </td>
                        <td className="px-5 py-4">
                          {Math.round(analysis.confidence * 100)}%
                          {analysis.needsManualReview ? (
                            <span className="mt-1 block text-xs text-amber-700">
                              需要复核
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-4 text-xs leading-5 text-emerald-700">
                          原图未保存
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-slate-50 p-10 text-center text-slate-500">
            暂无分析记录。
          </div>
        )}
      </section>
    </div>
  );
}
