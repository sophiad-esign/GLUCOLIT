/* eslint-disable i18next/no-literal-string, unicorn/prefer-add-event-listener */

"use client";

import { useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui-web/alert";
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

type FoodResult = {
  status: "reviewed" | "attention" | "needs-review";
  mealSummary: string;
  plateBalanceScore: number;
  glycemicLoad: "low" | "medium" | "high" | "uncertain";
  reportMarkdown: string;
  privacy: string;
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
        reject(new Error("无法处理这张照片"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("无法读取这张照片"));
    };
    image.src = objectUrl;
  });

export function FoodAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string>();
  const [fileName, setFileName] = useState("");
  const [mealType, setMealType] = useState("unknown");
  const [goal, setGoal] = useState("glucose");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FoodResult>();

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("请上传 PNG、JPG 或 WebP 照片。");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("照片不能超过 10 MB。");
      return;
    }
    setError("");
    setResult(undefined);
    setImageDataUrl(await compressImage(file));
    setFileName(file.name);
  };

  const analyze = async () => {
    if (!imageDataUrl) {
      setError("请先拍摄或上传一张完整餐食照片。");
      return;
    }
    if (!consent) {
      setError("请先确认照片与使用说明。");
      return;
    }
    setLoading(true);
    setError("");
    setResult(undefined);
    try {
      const response = await fetch("/api/ai/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl,
          mealType,
          goal,
          notes: notes.trim() || undefined,
          consent: true,
        }),
      });
      const payload = (await response.json()) as
        | FoodResult
        | { error?: string };
      if (!response.ok || !("reportMarkdown" in payload)) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "餐食分析暂时失败，请稍后重试。",
        );
      }
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "餐食分析暂时失败。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-slate-50/80 dark:bg-slate-900/70">
          <CardTitle className="text-2xl">拍一拍，看看这餐怎么搭</CardTitle>
          <CardDescription>
            原图不保存；照片只能估算食物与份量，不能替代称重和营养处方。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-72 w-full flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-[#2d5a87] dark:border-slate-700 dark:bg-slate-900"
          >
            {imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageDataUrl}
                alt="待分析餐食预览"
                className="max-h-96 w-full object-contain"
              />
            ) : (
              <>
                <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-[#1e3a5f] text-3xl text-white">
                  +
                </span>
                <span className="text-lg font-semibold">
                  拍照或选择餐食照片
                </span>
                <span className="mt-2 text-sm text-slate-500">
                  尽量拍全餐盘、饮料和蘸料
                </span>
              </>
            )}
          </button>
          {fileName ? (
            <p className="text-sm text-slate-500">{fileName}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="food-meal-type">这是哪一餐</Label>
              <select
                id="food-meal-type"
                value={mealType}
                onChange={(event) => setMealType(event.target.value)}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="unknown">不确定</option>
                <option value="breakfast">早餐</option>
                <option value="lunch">午餐</option>
                <option value="dinner">晚餐</option>
                <option value="snack">加餐</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="food-goal">本餐重点</Label>
              <select
                id="food-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="glucose">稳定餐后血糖</option>
                <option value="weight">控制体重</option>
                <option value="balanced">均衡营养</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="food-notes">补充说明（可选）</Label>
            <Input
              id="food-notes"
              value={notes}
              maxLength={300}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="例如：米饭半碗、无糖饮料、菜用了少量油"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 size-4"
            />
            <span>我确认照片不含人脸等隐私，并理解结果仅作营养教育参考。</span>
          </label>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>暂时无法完成分析</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            className="w-full"
            size="lg"
            disabled={loading}
            onClick={analyze}
          >
            {loading ? "AI 正在识别餐盘…" : "一键分析这餐"}
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl">营养与稳糖建议</CardTitle>
          <CardDescription>
            先看食物和目测份量，再给出下一餐就能执行的调整。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {result ? (
            <div className="space-y-5">
              <div
                className={`rounded-2xl border p-5 ${
                  result.status === "attention"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
              >
                <p className="text-sm font-semibold">餐盘平衡度</p>
                <p className="mt-1 text-3xl font-bold">
                  {Math.round(result.plateBalanceScore)}/100
                </p>
                <p className="mt-2">{result.mealSummary}</p>
              </div>
              <MessageResponse>{result.reportMarkdown}</MessageResponse>
              <p className="text-xs text-slate-500">{result.privacy}</p>
            </div>
          ) : (
            <div className="flex min-h-[32rem] items-center justify-center rounded-3xl border border-dashed bg-slate-50 p-8 text-center text-slate-500 dark:bg-slate-900">
              上传餐食照片后，这里会显示食物识别、餐盘结构、升糖风险和具体替换建议。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
