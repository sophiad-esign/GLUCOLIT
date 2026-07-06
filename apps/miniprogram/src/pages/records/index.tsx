import { Button, Input, Text, Textarea, View } from "@tarojs/components";
import { useState } from "react";

import { BrandHeader } from "../../components/brand-header";
import { apiRequest } from "../../lib/api";
import { readLocal, writeLocal } from "../../lib/storage";

type RecordItem = {
  date: string;
  sleepHours: number;
  energy: number;
  stress: number;
  aerobicMinutes: number;
  postMealMinutes: number;
  strengthMinutes: number;
  strengthSessions: number;
  exerciseNotes: string;
  context: string;
};
type Analysis = {
  summary: string;
  sleepAssessment: string;
  exerciseAssessment: string;
  priorities: string[];
  warnings: string[];
};
const today = () => new Date().toISOString().slice(0, 10);
const initial = (): RecordItem => ({
  date: today(),
  sleepHours: 7,
  energy: 5,
  stress: 5,
  aerobicMinutes: 0,
  postMealMinutes: 0,
  strengthMinutes: 0,
  strengthSessions: 0,
  exerciseNotes: "",
  context: "",
});

export default function RecordsPage() {
  const [records, setRecords] = useState<RecordItem[]>(
    readLocal("lifestyle-records", []),
  );
  const [record, setRecord] = useState(initial);
  const [analysis, setAnalysis] = useState<Analysis>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(
    readLocal("daily-core-action", false),
  );
  const number = (key: keyof RecordItem, value: string) =>
    setRecord((current) => ({ ...current, [key]: Number(value) || 0 }));
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const recent = records
        .filter((item) => item.date !== record.date)
        .slice(-13);
      const result = await apiRequest<Analysis>("/ai/lifestyle", {
        method: "POST",
        retry: false,
        data: { record, recentRecords: recent },
      });
      const next = [...recent, record].slice(-14);
      setRecords(next);
      writeLocal("lifestyle-records", next);
      setAnalysis(result);
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "分析失败，请稍后重试。",
      );
      const next = [
        ...records.filter((item) => item.date !== record.date),
        record,
      ].slice(-14);
      setRecords(next);
      writeLocal("lifestyle-records", next);
    } finally {
      setBusy(false);
    }
  };
  const fields: [keyof RecordItem, string, string][] = [
    ["sleepHours", "睡眠时长（小时）", "7"],
    ["energy", "白天精力（1—10）", "5"],
    ["stress", "压力程度（1—10）", "5"],
    ["postMealMinutes", "饭后活动（分钟）", "0"],
    ["aerobicMinutes", "其他有氧（分钟）", "0"],
    ["strengthMinutes", "抗阻训练（分钟）", "0"],
    ["strengthSessions", "今天抗阻训练次数", "0"],
  ];
  return (
    <View className="page">
      <BrandHeader />
      <View className="hero">
        <View className="row">
          <View>
            <View className="eyebrow">今日行动</View>
            <View className="hero-title">今天，只专注这 1 件事</View>
          </View>
          <Button
            className="button ghost"
            onClick={() => {
              const next = !completed;
              setCompleted(next);
              writeLocal("daily-core-action", next);
            }}
          >
            {completed ? "已做到 ✓" : "我做到了"}
          </Button>
        </View>
        <View className="hero-copy">
          先把这件事搞定，其他都是加分项，不要有压力。
        </View>
      </View>
      <View className="eyebrow">核心行动 {completed ? "1/1" : "0/1"}</View>
      <View className="card">
        <Text className="status-pill">核心行动</Text>
        <View className="card-title">运动</View>
        <View className="action-step">
          <View className="action-label">怎么去做</View>
          饭后约 30 分钟开始散步，体力不足时先走 15–20 分钟。
        </View>
        <View className="action-step">
          <View className="action-label">为什么做</View>
          饭后轻度活动可以帮助身体更平稳地利用这一餐带来的能量。
        </View>
        <View className="action-step">
          <View className="action-label">做不到时</View>
          哪怕只走 8 分钟也算完成；不追求完美，只保留节奏。
        </View>
      </View>
      <View className="card">
        <View className="card-title">加分项：记录今天</View>
        <View className="muted">
          用七日变化观察恢复与活动节奏，单日数据不用于诊断。
        </View>
      </View>
      {error && (
        <View className="notice error">{error} 本次记录已安全保存在本机。</View>
      )}
      <View className="card">
        {fields.map(([key, label, placeholder]) => (
          <View key={key}>
            <View className="label">{label}</View>
            <Input
              className="input"
              type="digit"
              value={String(record[key])}
              placeholder={placeholder}
              onInput={(event) => number(key, event.detail.value)}
            />
          </View>
        ))}
        <View className="label">运动备注</View>
        <Textarea
          className="textarea"
          maxlength={500}
          value={record.exerciseNotes}
          onInput={(event) =>
            setRecord((current) => ({
              ...current,
              exerciseNotes: event.detail.value,
            }))
          }
          placeholder="例如：快走、深蹲，是否有疼痛或疲劳"
        />
        <View className="label">今天的特殊情况</View>
        <Textarea
          className="textarea"
          maxlength={500}
          value={record.context}
          onInput={(event) =>
            setRecord((current) => ({
              ...current,
              context: event.detail.value,
            }))
          }
          placeholder="例如：出差、加班、生病"
        />
        <Button
          loading={busy}
          disabled={busy}
          className="button"
          onClick={save}
        >
          保存并分析
        </Button>
      </View>
      {analysis && (
        <View className="card">
          <View className="card-title">本周趋势</View>
          <View>{analysis.summary}</View>
          <View className="card-title">睡眠</View>
          <View>{analysis.sleepAssessment}</View>
          <View className="card-title">运动</View>
          <View>{analysis.exerciseAssessment}</View>
          <View className="card-title">接下来优先做</View>
          {analysis.priorities.map((item, index) => (
            <View key={item}>
              {index + 1}. {item}
            </View>
          ))}
          {analysis.warnings.map((item) => (
            <View className="notice" key={item}>
              {item}
            </View>
          ))}
        </View>
      )}
      <View className="card">
        <View className="card-title">最近记录</View>
        {records
          .slice(-7)
          .reverse()
          .map((item) => (
            <View className="muted" key={item.date}>
              {item.date} · 睡眠 {item.sleepHours}h · 活动{" "}
              {item.postMealMinutes + item.aerobicMinutes} 分钟
            </View>
          ))}
        {!records.length && (
          <View className="muted">保存第一条记录后，这里会出现七日趋势。</View>
        )}
      </View>
    </View>
  );
}
