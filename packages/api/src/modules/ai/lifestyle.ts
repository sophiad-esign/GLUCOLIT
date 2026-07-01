import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

const recordSchema = z.object({
  date: z.string().max(20),
  sleepHours: z.number().min(0).max(24),
  deepSleepPercent: z.number().min(0).max(100).optional(),
  remPercent: z.number().min(0).max(100).optional(),
  awakenings: z.number().int().min(0).max(30).optional(),
  energy: z.number().int().min(1).max(10),
  stress: z.number().int().min(1).max(10),
  aerobicMinutes: z.number().int().min(0).max(600),
  postMealMinutes: z.number().int().min(0).max(300),
  strengthMinutes: z.number().int().min(0).max(300),
  strengthSessions: z.number().int().min(0).max(20),
  steps: z.number().int().min(0).max(100000).optional(),
  exerciseNotes: z.string().max(500),
  context: z.string().max(500),
  fastingGlucose: z.number().min(1).max(30).optional(),
});

export const lifestyleAnalysisRequestSchema = z.object({
  record: recordSchema,
  recentRecords: z.array(recordSchema).max(14).default([]),
});

const responseSchema = z.object({
  summary: z.string().min(1).max(1200),
  sleepAssessment: z.string().min(1).max(800),
  exerciseAssessment: z.string().min(1).max(800),
  priorities: z.array(z.string().min(1).max(220)).min(1).max(4),
  warnings: z.array(z.string().min(1).max(300)).max(4),
});

type Input = z.infer<typeof lifestyleAnalysisRequestSchema>;

const getModel = () => {
  if (process.env.KIMI_API_KEY) {
    return createOpenAI({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
      name: "kimi",
    }).chat(process.env.KIMI_LIFESTYLE_MODEL || "moonshot-v1-8k");
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses(
      process.env.OPENAI_LIFESTYLE_MODEL || "gpt-4.1-mini",
    );
  }
  throw new Error("KIMI_API_KEY or OPENAI_API_KEY is required");
};

const average = (values: number[]) =>
  values.length
    ? Math.round(
        (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
      ) / 10
    : 0;

const deterministicAnalysis = (input: Input) => {
  const records = [...input.recentRecords, input.record].slice(-7);
  const sleepAverage = average(records.map((record) => record.sleepHours));
  const aerobicTotal = records.reduce(
    (sum, record) => sum + record.aerobicMinutes + record.postMealMinutes,
    0,
  );
  const strengthDays = records.filter(
    (record) => record.strengthMinutes > 0 || record.strengthSessions > 0,
  ).length;
  const shortSleepDays = records.filter(
    (record) => record.sleepHours < 7,
  ).length;
  const lowEnergyDays = records.filter((record) => record.energy <= 5).length;
  const warnings: string[] = [];

  if (input.record.sleepHours < 5 || input.record.energy <= 3) {
    warnings.push(
      "今天恢复状态偏低。若伴随明显头晕、胸痛、呼吸困难、晕厥或持续不适，请停止训练并及时就医。",
    );
  }
  if (input.record.awakenings && input.record.awakenings >= 3) {
    warnings.push(
      "夜间醒来较多；若持续发生并伴随严重打鼾、憋醒或白天嗜睡，建议咨询医生评估睡眠问题。",
    );
  }

  return {
    summary: `最近${records.length}天平均睡眠约${sleepAverage}小时，有氧与饭后活动累计${aerobicTotal}分钟，抗阻训练${strengthDays}天。记录的价值在于观察趋势，不建议根据单日可穿戴设备睡眠分期或单次血糖自行诊断。`,
    sleepAssessment:
      shortSleepDays >= 3
        ? `最近一周有${shortSleepDays}天不足7小时，恢复不足可能与精力、压力和运动意愿同时波动。先优先稳定起床时间，并连续观察两周。`
        : "最近睡眠时长整体接近成年人通常建议的每晚至少7小时；继续关注规律性、夜醒和白天精力，而不是只追逐深睡或REM百分比。",
    exerciseAssessment:
      aerobicTotal >= 150 && strengthDays >= 2
        ? "最近一周已达到常见成人活动建议的核心组合：至少150分钟中等强度活动，并有2天以上抗阻训练。接下来优先保持稳定和恢复。"
        : `最近一周累计活动${aerobicTotal}分钟、抗阻${strengthDays}天。成人常见目标是每周至少150分钟中等强度活动并安排2天抗阻训练，但应按体能逐步增加。`,
    priorities: [
      shortSleepDays >= 3
        ? "今晚先争取固定时间上床和起床，睡前一小时减少强光与高刺激活动。"
        : "继续保持规律作息，并用白天精力验证睡眠是否真正恢复。",
      aerobicTotal < 150
        ? "把运动拆小：下一餐后先步行10分钟，本周再逐步补足活动量。"
        : "保持当前有氧节奏，不为追求数字突然增加强度。",
      strengthDays < 2
        ? "本周增加1次短时抗阻训练，优先动作质量而不是次数。"
        : "抗阻训练后安排恢复日，关注异常疼痛和持续疲劳。",
    ],
    warnings:
      lowEnergyDays >= 3
        ? [
            ...warnings,
            `最近一周有${lowEnergyDays}天精力较低，应先排查睡眠、进食不足、疾病或过度训练，不建议硬扛高强度运动。`,
          ]
        : warnings,
  };
};

const parseResponse = (text: string) => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = responseSchema.safeParse(
      JSON.parse(cleaned.slice(start, end + 1)),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const analyzeLifestyle = async (input: Input) => {
  const fallback = deterministicAnalysis(input);
  try {
    const { text } = await generateText({
      model: getModel(),
      system: `You are GLUCOLIT's Chinese lifestyle medicine education assistant for adults with prediabetes.
Use the deterministic reference summary as the safety baseline. Explain trends without diagnosing or claiming causality from a few days of data.
Wearable deep-sleep and REM percentages are estimates, not diagnostic sleep studies.
Do not prescribe medication, extreme exercise, fasting, or weight-loss targets. For pain, fainting, chest pain, severe breathlessness, persistent severe fatigue, or suspected sleep apnea, recommend professional assessment.
Use direct, compassionate Simplified Chinese. Return JSON only with keys summary, sleepAssessment, exerciseAssessment, priorities, warnings.`,
      prompt: JSON.stringify({
        current: input.record,
        recentRecords: input.recentRecords,
        deterministicReference: fallback,
      }),
    });
    return parseResponse(text) || fallback;
  } catch (error) {
    console.error("Lifestyle analysis model unavailable; using rules", error);
    return fallback;
  }
};
