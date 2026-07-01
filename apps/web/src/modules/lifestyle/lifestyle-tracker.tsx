/* eslint-disable i18next/no-literal-string */

"use client";

import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui-web/alert";
import { Button } from "@workspace/ui-web/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui-web/card";
import { Input } from "@workspace/ui-web/input";

import { MessageResponse } from "~/components/ai-elements/message";

type RecordEntry = {
  id: string;
  date: string;
  sleepHours: number;
  deepSleepPercent?: number;
  remPercent?: number;
  awakenings?: number;
  energy: number;
  stress: number;
  aerobicMinutes: number;
  postMealMinutes: number;
  strengthMinutes: number;
  strengthSessions: number;
  steps?: number;
  exerciseNotes: string;
  context: string;
  fastingGlucose?: number;
};

type Analysis = {
  summary: string;
  sleepAssessment: string;
  exerciseAssessment: string;
  priorities: string[];
  warnings: string[];
};

type Props = { focus?: "diet" | "exercise-sleep" };

const STORAGE_KEY = "glucolit-lifestyle-records-v1";
const today = () => new Date().toISOString().slice(0, 10);
const numberOrUndefined = (value: string) =>
  value === "" ? undefined : Number(value);

export function LifestyleTracker({ focus = "exercise-sleep" }: Props) {
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [date, setDate] = useState(today());
  const [sleepHours, setSleepHours] = useState("7.5");
  const [deepSleepPercent, setDeepSleepPercent] = useState("");
  const [remPercent, setRemPercent] = useState("");
  const [awakenings, setAwakenings] = useState("");
  const [energy, setEnergy] = useState("7");
  const [stress, setStress] = useState("6");
  const [aerobicMinutes, setAerobicMinutes] = useState("0");
  const [postMealMinutes, setPostMealMinutes] = useState("0");
  const [strengthMinutes, setStrengthMinutes] = useState("0");
  const [strengthSessions, setStrengthSessions] = useState("0");
  const [steps, setSteps] = useState("");
  const [exerciseNotes, setExerciseNotes] = useState("");
  const [context, setContext] = useState("");
  const [fastingGlucose, setFastingGlucose] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRecords(JSON.parse(saved) as RecordEntry[]);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const persist = (next: RecordEntry[]) => {
    setRecords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const submit = async () => {
    setError("");
    setAnalysis(null);
    if (Number(sleepHours) <= 0 || Number(sleepHours) > 24) {
      setError("请填写0到24小时之间的睡眠时长。");
      return;
    }

    const record: RecordEntry = {
      id: `${date}-${Date.now()}`,
      date,
      sleepHours: Number(sleepHours),
      deepSleepPercent: numberOrUndefined(deepSleepPercent),
      remPercent: numberOrUndefined(remPercent),
      awakenings: numberOrUndefined(awakenings),
      energy: Number(energy),
      stress: Number(stress),
      aerobicMinutes: Number(aerobicMinutes),
      postMealMinutes: Number(postMealMinutes),
      strengthMinutes: Number(strengthMinutes),
      strengthSessions: Number(strengthSessions),
      steps: numberOrUndefined(steps),
      exerciseNotes: exerciseNotes.trim(),
      context: context.trim(),
      fastingGlucose: numberOrUndefined(fastingGlucose),
    };
    const recentRecords = records
      .filter((item) => item.date !== date)
      .slice(-13)
      .map(({ id: _id, ...item }) => item);
    const next = [...records.filter((item) => item.date !== date), record]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
    persist(next);
    setLoading(true);
    try {
      const response = await fetch("/api/ai/lifestyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: (({ id: _id, ...item }) => item)(record),
          recentRecords,
        }),
      });
      const payload = (await response.json()) as Analysis & { error?: string };
      if (!response.ok) throw new Error(payload.error || "分析暂时失败。");
      setAnalysis(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分析暂时失败。");
    } finally {
      setLoading(false);
    }
  };

  const recent = records.slice(-7).reverse();

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="bg-gradient-to-r from-sky-50 to-orange-50">
        <CardTitle className="text-2xl">
          {focus === "diet"
            ? "饮食之外：睡眠与运动影响记录"
            : "睡眠与运动数据追踪"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        <section>
          <h3 className="text-lg font-bold">睡眠与恢复</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="日期">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="睡眠时长（小时）">
              <Input
                type="number"
                min={0}
                max={24}
                step={0.1}
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
              />
            </Field>
            <Field label="深睡 %（选填）">
              <Input
                type="number"
                min={0}
                max={100}
                value={deepSleepPercent}
                onChange={(e) => setDeepSleepPercent(e.target.value)}
              />
            </Field>
            <Field label="REM %（选填）">
              <Input
                type="number"
                min={0}
                max={100}
                value={remPercent}
                onChange={(e) => setRemPercent(e.target.value)}
              />
            </Field>
            <Field label="夜醒次数（选填）">
              <Input
                type="number"
                min={0}
                max={30}
                value={awakenings}
                onChange={(e) => setAwakenings(e.target.value)}
              />
            </Field>
            <Field label={`精力状态：${energy}/10`}>
              <Input
                type="range"
                min={1}
                max={10}
                value={energy}
                onChange={(e) => setEnergy(e.target.value)}
              />
            </Field>
            <Field label={`压力状态：${stress}/10`}>
              <Input
                type="range"
                min={1}
                max={10}
                value={stress}
                onChange={(e) => setStress(e.target.value)}
              />
            </Field>
            <Field label="空腹血糖 mmol/L（选填）">
              <Input
                type="number"
                min={1}
                max={30}
                step={0.1}
                value={fastingGlucose}
                onChange={(e) => setFastingGlucose(e.target.value)}
              />
            </Field>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            可穿戴设备的深睡与REM属于估算值，应重点观察连续趋势和白天精力，不能代替睡眠医学检查。
          </p>
        </section>

        <section>
          <h3 className="text-lg font-bold">运动与活动</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="有氧运动（分钟）">
              <Input
                type="number"
                min={0}
                max={600}
                value={aerobicMinutes}
                onChange={(e) => setAerobicMinutes(e.target.value)}
              />
            </Field>
            <Field label="饭后步行/活动（分钟）">
              <Input
                type="number"
                min={0}
                max={300}
                value={postMealMinutes}
                onChange={(e) => setPostMealMinutes(e.target.value)}
              />
            </Field>
            <Field label="抗阻训练（分钟）">
              <Input
                type="number"
                min={0}
                max={300}
                value={strengthMinutes}
                onChange={(e) => setStrengthMinutes(e.target.value)}
              />
            </Field>
            <Field label="抗阻组数">
              <Input
                type="number"
                min={0}
                max={20}
                value={strengthSessions}
                onChange={(e) => setStrengthSessions(e.target.value)}
              />
            </Field>
            <Field label="步数（选填）">
              <Input
                type="number"
                min={0}
                max={100000}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="运动内容">
              <textarea
                className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="例如：饭后步行20分钟 + 弹力带15分钟"
                value={exerciseNotes}
                onChange={(e) => setExerciseNotes(e.target.value)}
              />
            </Field>
            <Field label="当天特殊情况（选填）">
              <textarea
                className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="例如：失眠、经期、出差、头晕、训练后异常疲劳"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </Field>
          </div>
        </section>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>暂时无法完成</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" size="lg" onClick={submit} disabled={loading}>
          {loading ? "正在分析最近趋势…" : "保存并生成专业分析"}
        </Button>

        {analysis ? <AnalysisPanel analysis={analysis} /> : null}

        {recent.length ? (
          <section>
            <h3 className="text-lg font-bold">最近7条记录</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {recent.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border bg-slate-50 p-4 text-sm"
                >
                  <p className="font-semibold">{item.date}</p>
                  <p className="mt-2 text-slate-600">
                    睡眠 {item.sleepHours}h · 精力 {item.energy}/10 · 压力{" "}
                    {item.stress}/10
                  </p>
                  <p className="mt-1 text-slate-600">
                    活动 {item.aerobicMinutes + item.postMealMinutes} 分钟 ·
                    抗阻 {item.strengthMinutes} 分钟
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: Analysis }) {
  return (
    <section className="space-y-5 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-slate-900">
      <div>
        <h3 className="font-bold">综合判断</h3>
        <MessageResponse>{analysis.summary}</MessageResponse>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4">
          <h4 className="font-semibold">睡眠与恢复</h4>
          <MessageResponse>{analysis.sleepAssessment}</MessageResponse>
        </div>
        <div className="rounded-xl bg-white p-4">
          <h4 className="font-semibold">运动与活动</h4>
          <MessageResponse>{analysis.exerciseAssessment}</MessageResponse>
        </div>
      </div>
      <div>
        <h4 className="font-semibold">下一步优先级</h4>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          {analysis.priorities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
      {analysis.warnings.length ? (
        <Alert variant="destructive">
          <AlertTitle>需要留意</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {analysis.warnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <p className="text-xs text-slate-500">
        本结果用于健康教育和趋势观察，不替代医生诊断、睡眠医学检查或个体化运动处方。
      </p>
    </section>
  );
}
