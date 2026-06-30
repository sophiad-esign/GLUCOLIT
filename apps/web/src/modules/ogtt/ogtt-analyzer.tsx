/* eslint-disable i18next/no-literal-string, unicorn/prefer-add-event-listener */

"use client";

import { useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui-web/alert";
import { Badge } from "@workspace/ui-web/badge";
import { Button } from "@workspace/ui-web/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui-web/card";
import { Input } from "@workspace/ui-web/input";
import { Label } from "@workspace/ui-web/label";

import { MessageResponse } from "~/components/ai-elements/message";

type Metrics = {
  glucoseUnit: "mmol/L" | "mg/dL";
  insulinUnit: string | null;
  fastingGlucose: number | null;
  glucose30: number | null;
  glucose60: number | null;
  glucose120: number | null;
  glucose180: number | null;
  fastingInsulin: number | null;
  insulin30: number | null;
  insulin60: number | null;
  insulin120: number | null;
  insulin180: number | null;
  hba1c: number | null;
  confidence: number;
  uncertainFields: string[];
};

type AnalysisResult = {
  id: string;
  metrics: Metrics;
  riskLevel: "normal" | "prediabetes" | "diabetes-range" | "needs-review";
  classification: string;
  confidence: number;
  needsManualReview: boolean;
  bmi: number | null;
  homaIr: number | null;
  reportMarkdown: string;
  privacy: string;
};

const riskStyles: Record<AnalysisResult["riskLevel"], string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
  prediabetes: "border-amber-200 bg-amber-50 text-amber-800",
  "diabetes-range": "border-red-200 bg-red-50 text-red-800",
  "needs-review": "border-slate-200 bg-slate-50 text-slate-700",
};

const compressImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("无法处理这张图片"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("无法读取这张图片"));
    };
    image.src = objectUrl;
  });

const numberOrUndefined = (value: string) => {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
};

export function OgttAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string>();
  const [fileName, setFileName] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [unit, setUnit] = useState<Metrics["glucoseUnit"]>("mmol/L");
  const [fasting, setFasting] = useState("");
  const [glucose60, setGlucose60] = useState("");
  const [glucose120, setGlucose120] = useState("");
  const [fastingInsulin, setFastingInsulin] = useState("");
  const [insulin120, setInsulin120] = useState("");
  const [hba1c, setHba1c] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activity, setActivity] = useState<"low" | "moderate" | "high">(
    "moderate",
  );
  const [pregnancy, setPregnancy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult>();

  const handleFile = async (file?: File) => {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("请上传 PNG、JPG 或 WebP 图片。");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("图片不能超过 10 MB。");
      return;
    }

    setError("");
    setResult(undefined);
    setImageDataUrl(await compressImage(file));
    setFileName(file.name);
  };

  const analyze = async () => {
    const hasManualValue = [fasting, glucose60, glucose120, hba1c].some(
      (value) => value.trim(),
    );

    if (!imageDataUrl && !hasManualValue) {
      setError("请先上传报告截图，或展开手动校对并填写至少一个血糖指标。");
      return;
    }
    if (!consent) {
      setError("请先确认隐私与使用说明。");
      return;
    }

    setLoading(true);
    setError("");
    setResult(undefined);

    try {
      const response = await fetch("/api/ai/ogtt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl,
          manualMetrics: hasManualValue
            ? {
                glucoseUnit: unit,
                fastingGlucose: numberOrUndefined(fasting),
                glucose60: numberOrUndefined(glucose60),
                glucose120: numberOrUndefined(glucose120),
                fastingInsulin: numberOrUndefined(fastingInsulin),
                insulin120: numberOrUndefined(insulin120),
                hba1c: numberOrUndefined(hba1c),
              }
            : undefined,
          profile: {
            age: numberOrUndefined(age),
            heightCm: numberOrUndefined(heightCm),
            weightKg: numberOrUndefined(weightKg),
            activity,
            pregnancy,
          },
          consent: true,
        }),
      });
      const payload = (await response.json()) as
        | AnalysisResult
        | { error?: string };

      if (!response.ok || !("reportMarkdown" in payload)) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "分析暂时失败，请稍后重试。",
        );
      }

      setResult(payload);
      setImageDataUrl(undefined);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分析暂时失败。");
      setManualOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-slate-50/80 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">上传 OGTT 体检报告</CardTitle>
              <CardDescription className="mt-2 leading-6">
                支持 OGTT 血糖曲线、胰岛素释放曲线与 HbA1c 报告截图。
              </CardDescription>
            </div>
            <Badge variant="outline">原图不留存</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <button
            type="button"
            className="group relative flex min-h-64 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-[#2d5a87] hover:bg-sky-50/60 dark:border-slate-700 dark:bg-slate-900"
            onClick={() => inputRef.current?.click()}
          >
            {imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageDataUrl}
                alt="待分析的体检报告预览"
                className="max-h-80 rounded-xl object-contain shadow-sm"
              />
            ) : (
              <>
                <span className="grid size-14 place-items-center rounded-full bg-[#1e3a5f] text-2xl text-white">
                  +
                </span>
                <span className="mt-4 text-lg font-semibold">
                  点击选择或拍摄报告
                </span>
                <span className="text-muted-foreground mt-2 text-sm">
                  请尽量遮住姓名、身份证号、条形码等个人信息
                </span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          {fileName ? (
            <p className="text-muted-foreground text-xs">
              已选择：{fileName}。系统会先压缩图片再进行识别。
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ogtt-age">年龄（可选）</Label>
              <Input
                id="ogtt-age"
                inputMode="numeric"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                placeholder="例如 42"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ogtt-height">身高 cm（可选）</Label>
              <Input
                id="ogtt-height"
                inputMode="decimal"
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                placeholder="例如 165"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ogtt-weight">体重 kg（可选）</Label>
              <Input
                id="ogtt-weight"
                inputMode="decimal"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
                placeholder="例如 68"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ogtt-activity">目前活动水平</Label>
            <select
              id="ogtt-activity"
              value={activity}
              onChange={(event) =>
                setActivity(event.target.value as typeof activity)
              }
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="low">较少运动</option>
              <option value="moderate">每周有一些运动</option>
              <option value="high">规律运动</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={pregnancy}
              onChange={(event) => setPregnancy(event.target.checked)}
              className="mt-1 size-4 rounded border-slate-300"
            />
            <span>
              当前处于妊娠期（将提示使用产科专用标准，不按普通成人糖前标准分层）
            </span>
          </label>

          <button
            type="button"
            className="text-sm font-semibold text-[#1e3a5f] underline-offset-4 hover:underline dark:text-sky-200"
            onClick={() => setManualOpen((open) => !open)}
          >
            {manualOpen ? "收起手动校对" : "识别不清？展开手动校对数值"}
          </button>

          {manualOpen ? (
            <div className="space-y-4 rounded-2xl border bg-slate-50 p-4 dark:bg-slate-900">
              <div className="space-y-2">
                <Label htmlFor="ogtt-unit">血糖单位</Label>
                <select
                  id="ogtt-unit"
                  value={unit}
                  onChange={(event) =>
                    setUnit(event.target.value as typeof unit)
                  }
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                >
                  <option value="mmol/L">mmol/L</option>
                  <option value="mg/dL">mg/dL</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    id: "manual-fasting-glucose",
                    label: "空腹血糖",
                    value: fasting,
                    setter: setFasting,
                  },
                  {
                    id: "manual-glucose-60",
                    label: "60 分钟血糖",
                    value: glucose60,
                    setter: setGlucose60,
                  },
                  {
                    id: "manual-glucose-120",
                    label: "120 分钟血糖",
                    value: glucose120,
                    setter: setGlucose120,
                  },
                  {
                    id: "manual-fasting-insulin",
                    label: "空腹胰岛素",
                    value: fastingInsulin,
                    setter: setFastingInsulin,
                  },
                  {
                    id: "manual-insulin-120",
                    label: "120 分钟胰岛素",
                    value: insulin120,
                    setter: setInsulin120,
                  },
                  {
                    id: "manual-hba1c",
                    label: "HbA1c %",
                    value: hba1c,
                    setter: setHba1c,
                  },
                ].map(({ id, label, value, setter }) => (
                  <div className="space-y-2" key={id}>
                    <Label htmlFor={id}>{label}</Label>
                    <Input
                      id={id}
                      inputMode="decimal"
                      value={value}
                      onChange={(event) => setter(event.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 size-4 rounded border-slate-300"
            />
            <span>
              我已遮挡不必要的个人信息，并理解本工具用于健康教育与就医准备，不替代医生诊断。
            </span>
          </label>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>暂时无法完成分析</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            size="lg"
            className="w-full bg-[#1e3a5f] hover:bg-[#2d5a87]"
            disabled={loading}
            onClick={() => void analyze()}
          >
            {loading ? "正在识别并生成分析…" : "一键分析 OGTT 报告"}
          </Button>
        </CardContent>
      </Card>

      <Card className="min-h-[44rem] shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl">专业指标解读</CardTitle>
          <CardDescription className="leading-6">
            先核对识别值，再看风险分层和可执行建议。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-5" aria-live="polite">
              <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
              <div className="h-52 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
              <p className="text-muted-foreground text-sm">
                正在识别采血时间、单位和数值，并进行医学规则交叉校验。
              </p>
            </div>
          ) : result ? (
            <div className="space-y-6">
              <div
                className={`rounded-2xl border p-5 ${riskStyles[result.riskLevel]}`}
              >
                <p className="text-xs font-semibold tracking-[0.16em] uppercase">
                  分析结论
                </p>
                <p className="mt-2 text-xl font-bold">
                  {result.classification}
                </p>
                <p className="mt-2 text-sm">
                  识别置信度 {Math.round(result.confidence * 100)}%
                  {result.needsManualReview
                    ? " · 请对照原报告人工校对"
                    : " · 关键字段已完整识别"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["空腹血糖", result.metrics.fastingGlucose],
                  ["60 分钟", result.metrics.glucose60],
                  ["120 分钟", result.metrics.glucose120],
                  ["HbA1c", result.metrics.hba1c],
                ].map(([label, value]) => (
                  <div className="rounded-xl border p-3" key={label as string}>
                    <p className="text-muted-foreground text-xs">
                      {label as string}
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold">
                      {value == null ? "—" : String(value)}
                    </p>
                  </div>
                ))}
              </div>

              <MessageResponse className="prose-slate dark:prose-invert max-w-none text-sm leading-7">
                {result.reportMarkdown}
              </MessageResponse>

              <Alert variant="primary">
                <AlertTitle>隐私说明</AlertTitle>
                <AlertDescription>{result.privacy}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="grid min-h-[32rem] place-items-center rounded-2xl border border-dashed bg-slate-50 p-8 text-center dark:bg-slate-900">
              <div>
                <p className="text-5xl">🧪</p>
                <h3 className="mt-5 text-xl font-bold">
                  上传后会在这里生成分析
                </h3>
                <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-7">
                  包括空腹与 2
                  小时血糖分层、胰岛素曲线提示、识别置信度、需要复核的字段，以及分阶段生活方式建议。
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
