/* eslint-disable i18next/no-literal-string */

"use client";

import { useEffect, useState } from "react";

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

type View = "checkin" | "chat" | "restart" | "weekly";
type Checkin = {
  date: string;
  mood: number;
  difficulty: number;
  trigger: string;
  note: string;
  smallestAction: string;
};
type ChatMessage = { role: "user" | "assistant"; content: string };
type CoachResponse = {
  crisis: boolean;
  reply: string;
  nextAction: string;
  affirmation: string;
};
type StoredState = {
  dayNumber: number;
  checkins: Checkin[];
  messages: ChatMessage[];
};

const STORAGE_KEY = "glucolit-companion-v1";
const today = () => new Date().toISOString().slice(0, 10);
const emptyState: StoredState = { dayNumber: 1, checkins: [], messages: [] };

const viewLabels: { value: View; label: string }[] = [
  { value: "checkin", label: "每日签到" },
  { value: "chat", label: "陪伴对话" },
  { value: "restart", label: "重新开始" },
  { value: "weekly", label: "每周复盘" },
];

function CoachReply({ result }: { result: CoachResponse }) {
  return (
    <div
      className={`space-y-4 rounded-2xl border p-5 ${
        result.crisis
          ? "border-red-300 bg-red-50 text-red-950"
          : "border-sky-200 bg-sky-50 text-slate-900"
      }`}
    >
      <MessageResponse>{result.reply}</MessageResponse>
      <div className="rounded-xl bg-white/80 p-4">
        <p className="text-xs font-semibold tracking-wide uppercase">
          现在只做这一件事
        </p>
        <p className="mt-2 font-medium">{result.nextAction}</p>
      </div>
      <p className="text-sm font-medium">{result.affirmation}</p>
    </div>
  );
}

export function CompanionCoach() {
  const [view, setView] = useState<View>("checkin");
  const [stored, setStored] = useState<StoredState>(emptyState);
  const [ready, setReady] = useState(false);
  const [mood, setMood] = useState(3);
  const [difficulty, setDifficulty] = useState(3);
  const [trigger, setTrigger] = useState("疲惫");
  const [note, setNote] = useState("");
  const [smallestAction, setSmallestAction] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [restartReason, setRestartReason] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CoachResponse>();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStored(JSON.parse(raw) as StoredState);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  const persist = (next: StoredState) => {
    setStored(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const askCoach = async (
    mode: "checkin" | "sos" | "chat" | "restart" | "weekly",
    message: string,
    checkins = stored.checkins,
    recentMessages = stored.messages,
  ) => {
    setLoading(mode);
    setError("");
    setResult(undefined);
    try {
      const response = await fetch("/api/ai/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          message,
          dayNumber: stored.dayNumber,
          checkins: checkins.slice(-14),
          recentMessages: recentMessages.slice(-8),
        }),
      });
      const payload = (await response.json()) as CoachResponse & {
        error?: string;
      };
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "陪伴回复暂时失败，请稍后重试。");
      }
      setResult(payload);
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "陪伴回复暂时失败。");
      return undefined;
    } finally {
      setLoading("");
    }
  };

  const saveCheckin = async () => {
    if (!smallestAction.trim()) {
      setError("请写下今天愿意完成的最小行动。");
      return;
    }
    const checkin: Checkin = {
      date: today(),
      mood,
      difficulty,
      trigger,
      note: note.trim(),
      smallestAction: smallestAction.trim(),
    };
    const checkins = [
      ...stored.checkins.filter((item) => item.date !== checkin.date),
      checkin,
    ].slice(-30);
    persist({ ...stored, checkins });
    await askCoach(
      "checkin",
      `今天的触发因素是${trigger}。我的感受：${note || "暂时说不清"}。我愿意完成的最小行动：${smallestAction}。`,
      checkins,
    );
  };

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message) return;
    const withUser: ChatMessage[] = [
      ...stored.messages,
      { role: "user" as const, content: message },
    ].slice(-20);
    persist({ ...stored, messages: withUser });
    setChatInput("");
    const response = await askCoach("chat", message, stored.checkins, withUser);
    if (response) {
      persist({
        ...stored,
        messages: [
          ...withUser,
          { role: "assistant" as const, content: response.reply },
        ].slice(-20),
      });
    }
  };

  const requestRestart = async () => {
    if (!restartReason.trim()) {
      setError("简单写下发生了什么，AI才能帮你制定重新开始计划。");
      return;
    }
    await askCoach("restart", restartReason.trim());
  };

  const requestWeekly = async () => {
    if (stored.checkins.length === 0) {
      setError("至少完成一次每日签到后，才能生成复盘。");
      return;
    }
    await askCoach(
      "weekly",
      "请根据最近七天记录生成情绪与执行复盘。",
      stored.checkins.slice(-7),
    );
  };

  if (!ready) {
    return <div className="h-96 animate-pulse rounded-3xl bg-slate-100" />;
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-rose-100 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-rose-50 to-sky-50">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <CardTitle className="text-2xl">糖前同行 · 陪伴教练</CardTitle>
              <CardDescription className="mt-2 max-w-2xl leading-6">
                难受时有人接住，偏离后还能重新开始。它是行为改变陪伴工具，不替代心理治疗或医疗服务。
              </CardDescription>
            </div>
            <label
              htmlFor="companion-day-number"
              className="flex items-center gap-2 text-sm font-medium"
            >
              当前第
              <Input
                id="companion-day-number"
                className="w-20"
                type="number"
                min={1}
                max={365}
                value={stored.dayNumber}
                onChange={(event) =>
                  persist({
                    ...stored,
                    dayNumber: Math.max(1, Number(event.target.value) || 1),
                  })
                }
              />
              天
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="w-full text-base"
            disabled={Boolean(loading)}
            onClick={() =>
              void askCoach(
                "sos",
                "我现在很想放弃，请先陪我度过接下来的三分钟。",
              )
            }
          >
            {loading === "sos" ? "正在陪你稳住这一刻…" : "我快坚持不住了"}
          </Button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {viewLabels.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={view === item.value ? "default" : "outline"}
                onClick={() => {
                  setView(item.value);
                  setResult(undefined);
                  setError("");
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {view === "checkin" ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>今天的心情：{mood}/5</Label>
                  <input
                    className="w-full accent-[#1e3a5f]"
                    type="range"
                    min={1}
                    max={5}
                    value={mood}
                    onChange={(event) => setMood(Number(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>坚持难度：{difficulty}/5</Label>
                  <input
                    className="w-full accent-[#1e3a5f]"
                    type="range"
                    min={1}
                    max={5}
                    value={difficulty}
                    onChange={(event) =>
                      setDifficulty(Number(event.target.value))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emotion-trigger">今天最难的触发因素</Label>
                <select
                  id="emotion-trigger"
                  value={trigger}
                  onChange={(event) => setTrigger(event.target.value)}
                  className="border-input bg-background h-10 w-full rounded-md border px-3"
                >
                  {[
                    "疲惫",
                    "饥饿",
                    "压力",
                    "聚餐",
                    "睡眠不足",
                    "指标焦虑",
                    "家人不理解",
                    "其他",
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emotion-note">此刻最真实的感受（可选）</Label>
                <textarea
                  id="emotion-note"
                  className="border-input min-h-24 w-full rounded-md border bg-transparent p-3"
                  value={note}
                  maxLength={500}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="例如：已经坚持很久，但体重没变化，我觉得很泄气。"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smallest-action">今天愿意完成的最小行动</Label>
                <Input
                  id="smallest-action"
                  value={smallestAction}
                  maxLength={200}
                  onChange={(event) => setSmallestAction(event.target.value)}
                  placeholder="例如：晚饭后只走10分钟"
                />
              </div>
              <Button
                disabled={Boolean(loading)}
                onClick={() => void saveCheckin()}
              >
                {loading === "checkin"
                  ? "正在回应你的签到…"
                  : "保存签到并获得回应"}
              </Button>
            </div>
          ) : null}

          {view === "chat" ? (
            <div className="space-y-4">
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">
                {stored.messages.length ? (
                  stored.messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`rounded-xl p-3 text-sm leading-6 ${
                        message.role === "user"
                          ? "ml-8 bg-[#1e3a5f] text-white"
                          : "mr-8 border bg-white"
                      }`}
                    >
                      {message.content}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    可以说出真实感受，例如：“我已经很努力了，为什么还是想吃甜食？”
                  </p>
                )}
              </div>
              <textarea
                className="border-input min-h-24 w-full rounded-md border bg-transparent p-3"
                value={chatInput}
                maxLength={1200}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="不用组织语言，想到什么就说什么。"
              />
              <Button
                disabled={Boolean(loading)}
                onClick={() => void sendChat()}
              >
                {loading === "chat" ? "正在认真听你说…" : "发送"}
              </Button>
            </div>
          ) : null}

          {view === "restart" ? (
            <div className="space-y-4">
              <p className="text-sm leading-7 text-slate-600">
                一次暴食、几天没运动或某项指标波动，都不会让之前的努力清零。
              </p>
              <textarea
                className="border-input min-h-32 w-full rounded-md border bg-transparent p-3"
                value={restartReason}
                maxLength={1200}
                onChange={(event) => setRestartReason(event.target.value)}
                placeholder="发生了什么？例如：连续加班三天，点了两次外卖，完全不想运动。"
              />
              <Button
                disabled={Boolean(loading)}
                onClick={() => void requestRestart()}
              >
                {loading === "restart"
                  ? "正在整理重新开始计划…"
                  : "生成24小时重新开始计划"}
              </Button>
            </div>
          ) : null}

          {view === "weekly" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">近7次签到</p>
                  <p className="mt-1 text-2xl font-bold">
                    {stored.checkins.slice(-7).length}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">平均心情</p>
                  <p className="mt-1 text-2xl font-bold">
                    {stored.checkins.length
                      ? (
                          stored.checkins
                            .slice(-7)
                            .reduce((sum, item) => sum + item.mood, 0) /
                          stored.checkins.slice(-7).length
                        ).toFixed(1)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">完成最小行动记录</p>
                  <p className="mt-1 text-2xl font-bold">
                    {
                      stored.checkins
                        .filter((item) => item.smallestAction)
                        .slice(-7).length
                    }
                  </p>
                </div>
              </div>
              <Button
                disabled={Boolean(loading)}
                onClick={() => void requestWeekly()}
              >
                {loading === "weekly"
                  ? "正在复盘这一周…"
                  : "生成本周情绪与执行复盘"}
              </Button>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>暂时无法完成</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {result ? <CoachReply result={result} /> : null}

          <p className="text-xs leading-5 text-slate-500">
            签到与聊天记录仅保存在当前浏览器。若你感到自己可能伤害自己，请立即联系可信任的人和当地急救服务，不要只依赖AI。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
