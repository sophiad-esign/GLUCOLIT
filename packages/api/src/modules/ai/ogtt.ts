import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

import { ogttAnalysis } from "@workspace/db/schema";
import { db } from "@workspace/db/server";
import { generateId } from "@workspace/shared/utils";

const nullableNumber = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  const normalized = value.trim();
  if (
    !normalized ||
    ["n/a", "na", "null", "none", "-", "--", "未检出"].includes(
      normalized.toLowerCase(),
    )
  ) {
    return null;
  }

  const parsed = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}, z.number().finite().nonnegative().nullable());

const confidenceNumber = z
  .preprocess((value) => {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return 0.5;

    const normalized = value.trim().toLowerCase();
    const parsed = Number(normalized.replace("%", ""));
    if (Number.isFinite(parsed)) {
      return normalized.includes("%") || parsed > 1 ? parsed / 100 : parsed;
    }
    if (["high", "高", "高置信度"].includes(normalized)) return 0.9;
    if (["medium", "moderate", "中", "中等"].includes(normalized)) return 0.7;
    if (["low", "低", "低置信度"].includes(normalized)) return 0.4;
    return 0.5;
  }, z.number().min(0).max(1))
  .catch(0.5);

const metricsSchema = z.object({
  glucoseUnit: z.enum(["mmol/L", "mg/dL"]),
  insulinUnit: z.string().nullable(),
  fastingGlucose: nullableNumber,
  glucose30: nullableNumber,
  glucose60: nullableNumber,
  glucose120: nullableNumber,
  glucose180: nullableNumber,
  fastingInsulin: nullableNumber,
  insulin30: nullableNumber,
  insulin60: nullableNumber,
  insulin120: nullableNumber,
  insulin180: nullableNumber,
  hba1c: nullableNumber,
  confidence: confidenceNumber,
  uncertainFields: z.array(z.string()).max(20).catch([]),
});

const profileSchema = z.object({
  age: z.number().int().min(18).max(100).nullable().optional(),
  sex: z.enum(["female", "male", "other", "unspecified"]).optional(),
  heightCm: z.number().min(120).max(230).nullable().optional(),
  weightKg: z.number().min(30).max(300).nullable().optional(),
  waistCm: z.number().min(40).max(220).nullable().optional(),
  activity: z.enum(["low", "moderate", "high"]).optional(),
  goal: z
    .enum(["understand", "prevent", "weight", "meal", "exercise"])
    .optional(),
  pregnancy: z.boolean().optional(),
});

export const ogttRequestSchema = z
  .object({
    imageDataUrl: z
      .string()
      .max(7_000_000)
      .refine(
        (value) => /^data:image\/(png|jpeg|webp);base64,/.test(value),
        "Only PNG, JPEG, and WebP screenshots are supported.",
      )
      .optional(),
    manualMetrics: metricsSchema.partial().optional(),
    profile: profileSchema.default({}),
    consent: z.literal(true),
  })
  .refine(
    (value) => value.imageDataUrl || value.manualMetrics,
    "Upload a report screenshot or enter the measurements manually.",
  );

export type OgttMetrics = z.infer<typeof metricsSchema>;
export type OgttProfile = z.infer<typeof profileSchema>;

const emptyMetrics: OgttMetrics = {
  glucoseUnit: "mmol/L",
  insulinUnit: null,
  fastingGlucose: null,
  glucose30: null,
  glucose60: null,
  glucose120: null,
  glucose180: null,
  fastingInsulin: null,
  insulin30: null,
  insulin60: null,
  insulin120: null,
  insulin180: null,
  hba1c: null,
  confidence: 1,
  uncertainFields: [],
};

const getVisionModel = () => {
  if (process.env.KIMI_API_KEY) {
    return createOpenAI({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
      name: "kimi",
    }).chat(process.env.KIMI_VISION_MODEL || "kimi-k2.5");
  }

  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }).responses(process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini");
  }

  throw new Error("KIMI_API_KEY or OPENAI_API_KEY is required");
};

const parseModelJson = (text: string) => {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  return metricsSchema.parse(JSON.parse(normalized));
};

const extractMetrics = async (imageDataUrl: string) => {
  const { text } = await generateText({
    model: getVisionModel(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract only clearly visible values from this Chinese or English laboratory report.
It may contain a 75 g OGTT glucose curve, an insulin-release curve, HbA1c, or related values.
Map fasting/0 min and 30/60/120/180 minute values to the schema.
Never infer a missing number. Use null when absent or unreadable.
Preserve the report's glucose unit. Insulin is often μIU/mL or mIU/L.
Set confidence conservatively and list every ambiguous field in uncertainFields.
Ignore names, ID numbers, phone numbers, addresses, barcodes, and other personal identifiers.
Return JSON only, without Markdown fences, using exactly these keys:
glucoseUnit, insulinUnit, fastingGlucose, glucose30, glucose60, glucose120,
glucose180, fastingInsulin, insulin30, insulin60, insulin120, insulin180,
hba1c, confidence, uncertainFields.
glucoseUnit must be "mmol/L" or "mg/dL". All missing numbers must be null.`,
          },
          { type: "image", image: imageDataUrl },
        ],
      },
    ],
  });

  return parseModelJson(text);
};

const mergeMetrics = (
  extracted: OgttMetrics,
  manual?: Partial<OgttMetrics>,
): OgttMetrics =>
  metricsSchema.parse({
    ...extracted,
    ...Object.fromEntries(
      Object.entries(manual ?? {}).filter(([, value]) => value !== undefined),
    ),
    uncertainFields:
      manual && Object.keys(manual).length > 0 ? [] : extracted.uncertainFields,
    confidence:
      manual && Object.keys(manual).length > 0 ? 1 : extracted.confidence,
  });

const toMmol = (value: number | null, unit: OgttMetrics["glucoseUnit"]) =>
  value == null ? null : unit === "mg/dL" ? value / 18 : value;

const fmt = (value: number | null, digits = 1) =>
  value == null ? "未识别" : value.toFixed(digits);

const calculateBmi = (profile: OgttProfile) => {
  if (!profile.heightCm || !profile.weightKg) {
    return null;
  }

  return profile.weightKg / (profile.heightCm / 100) ** 2;
};

export const buildOgttAnalysis = (
  metrics: OgttMetrics,
  profile: OgttProfile,
) => {
  const fasting = toMmol(metrics.fastingGlucose, metrics.glucoseUnit);
  const oneHour = toMmol(metrics.glucose60, metrics.glucoseUnit);
  const twoHour = toMmol(metrics.glucose120, metrics.glucoseUnit);
  const threeHour = toMmol(metrics.glucose180, metrics.glucoseUnit);
  const bmi = calculateBmi(profile);
  const severeHigh =
    (fasting != null && fasting >= 13.9) ||
    (oneHour != null && oneHour >= 13.9) ||
    (twoHour != null && twoHour >= 13.9);
  const low = [fasting, oneHour, twoHour, threeHour].some(
    (value) => value != null && value < 3.9,
  );

  let riskLevel = "needs-review";
  let classification = "信息不足，暂不能完成血糖分层";

  if (
    (fasting != null && fasting >= 7) ||
    (twoHour != null && twoHour >= 11.1) ||
    (metrics.hba1c != null && metrics.hba1c >= 6.5)
  ) {
    riskLevel = "diabetes-range";
    classification = "存在达到糖尿病诊断范围的指标";
  } else if (oneHour != null && oneHour >= 11.6) {
    riskLevel = "diabetes-range";
    classification = "1 小时血糖达到 IDF 建议的糖尿病筛查界值，需要复查确认";
  } else if (
    (fasting != null && fasting >= 5.6) ||
    (twoHour != null && twoHour >= 7.8) ||
    (oneHour != null && oneHour >= 8.6) ||
    (metrics.hba1c != null && metrics.hba1c >= 5.7 && metrics.hba1c < 6.5)
  ) {
    riskLevel = "prediabetes";
    classification =
      oneHour != null && oneHour >= 8.6
        ? "1 小时血糖达到 IDF 中间高血糖（糖尿病前期）范围"
        : "存在糖尿病前期范围的指标";
  } else if (
    fasting != null ||
    oneHour != null ||
    twoHour != null ||
    threeHour != null ||
    metrics.hba1c != null
  ) {
    riskLevel = "normal";
    classification = "已识别指标暂未达到糖尿病前期范围";
  }

  if (low && !profile.pregnancy) {
    classification += "；同时存在低于 3.9 mmol/L 的血糖值";
  }

  if (profile.pregnancy) {
    riskLevel = "needs-review";
    classification = "妊娠期需要按产科 OGTT 专用标准解读";
  }

  const homaIr =
    fasting != null && metrics.fastingInsulin != null
      ? (fasting * metrics.fastingInsulin) / 22.5
      : null;
  const needsManualReview =
    metrics.confidence < 0.82 ||
    metrics.uncertainFields.length > 0 ||
    (fasting == null && twoHour == null);

  const weightAdvice = profile.pregnancy
    ? "妊娠期体重管理目标需要结合孕前 BMI、孕周和产科评估制定，不建议自行减重。"
    : bmi != null && bmi >= 24
      ? `你的 BMI 约为 ${bmi.toFixed(1)}。如果医生确认适合减重，可把首阶段目标设为当前体重的 5%–7%，用 3–6 个月逐步完成。`
      : "目前没有足够信息判断是否需要减重；优先观察腰围、体重趋势、饮食质量和运动能力。";
  const activityAdvice =
    profile.activity === "low"
      ? "从每周 5 天、每次 10–15 分钟的饭后步行开始，逐步累计到每周至少 150 分钟中等强度活动。"
      : "保持每周至少 150 分钟中等强度活动，并加入每周 2–3 次覆盖大肌群的抗阻训练。";

  const reportMarkdown = `## 这份报告提示什么

**${classification}。**${
    riskLevel === "diabetes-range"
      ? " 单次无症状化验通常不能独立确诊，请尽快携带原始报告到内分泌科或全科复核。"
      : ""
  }${profile.pregnancy ? " 下表普通成人阈值仅作背景说明，不能用于妊娠糖尿病诊断。" : ""}

| 指标 | 识别值 | 解读参考 |
| --- | ---: | --- |
| 空腹血糖 | ${fmt(metrics.fastingGlucose)} ${metrics.glucoseUnit} | ADA 糖前范围从 5.6 mmol/L（100 mg/dL）起；WHO 空腹血糖受损阈值从 6.1 mmol/L 起 |
| OGTT 1 小时血糖 | ${fmt(metrics.glucose60)} ${metrics.glucoseUnit} | IDF：≥8.6 mmol/L 为中间高血糖界值；≥11.6 mmol/L 为糖尿病筛查界值，均需结合临床复核 |
| OGTT 2 小时血糖 | ${fmt(metrics.glucose120)} ${metrics.glucoseUnit} | 7.8–11.0 mmol/L 为糖耐量受损范围；≥11.1 mmol/L 达糖尿病诊断范围 |
| OGTT 3 小时血糖 | ${fmt(metrics.glucose180)} ${metrics.glucoseUnit} | <3.9 mmol/L 属需要关注的低血糖值；是否为反应性低血糖需结合症状与医生评估 |
| HbA1c | ${fmt(metrics.hba1c)}% | 5.7%–6.4% 为糖前范围；≥6.5% 达糖尿病诊断范围 |
| 空腹 / 1 小时 / 2 小时 / 3 小时胰岛素 | ${[metrics.fastingInsulin, metrics.insulin60, metrics.insulin120, metrics.insulin180].map((value) => fmt(value, 2)).join(" / ")} ${metrics.insulinUnit ?? ""} | 胰岛素释放曲线没有适用于所有实验室的统一诊断界值，应结合对应参考区间、血糖曲线和症状解读 |
${homaIr == null ? "" : `| HOMA-IR（估算） | ${homaIr.toFixed(2)} | 不同实验室与人群没有统一诊断界值，只能作趋势参考 |`}

## 个性化生活方式建议

1. **先把结果确认清楚。** 对照原始报告核对空腹、服糖后 2 小时、单位和采血时间；识别置信度为 ${Math.round(metrics.confidence * 100)}%。${needsManualReview ? "这份结果存在不确定字段，建议先人工校对。" : ""}
2. **活动计划。** ${activityAdvice}
3. **饮食实验。** ${low ? "报告中有低于 3.9 mmol/L 的数值，不建议自行采用长时间空腹、极低碳饮食或空腹高强度运动；规律进餐，并记录低血糖数值出现时是否伴随心慌、手抖、出汗、饥饿或头晕。" : "连续 2–4 周减少含糖饮料与精制主食，每餐优先安排非淀粉蔬菜、足量蛋白质，再吃主食；记录体重、腰围和餐后状态。"}
4. **体重与腰围。** ${weightAdvice}
5. **睡眠与复查。** 尽量固定睡眠时段；如果打鼾明显、白天嗜睡或血压偏高，可和医生讨论睡眠呼吸暂停筛查。复查时间由医生结合本次结果、症状和用药决定。

## 需要尽快就医的情况

${severeHigh ? "- 报告中出现明显高血糖数值，请尽快联系医疗机构；若同时有口渴、多尿、呕吐、腹痛、呼吸异常或意识改变，应及时急诊评估。" : "- 若出现明显口渴、多尿、体重快速下降、反复呕吐、腹痛、呼吸异常或意识改变，请及时就医。"}
${low ? "- 报告中存在低于 3.9 mmol/L 的数值；若伴出汗、心悸、手抖、视物异常或意识变化，应立即处理并就医。" : ""}

> 本分析用于健康教育和就医准备，不构成诊断、处方或个体化医疗治疗。妊娠期、未成年人、已确诊糖尿病或正在使用降糖药者，需要使用对应人群的临床标准，由医生解读。`;

  const reportWithSources = `${reportMarkdown}

## 参考标准

- [WHO：糖尿病与中间高血糖的定义和诊断](https://iris.who.int/handle/10665/43588)
- [IDF：采用 OGTT 1 小时血糖识别中间高血糖的立场声明](https://idf.org/news-and-resources/news/idf-position-statement-1-hour-pg-test/)
- [ADA：低血糖分级与处理标准](https://diabetesjournals.org/care/article/49/Supplement_1/S132/163927/6-Glycemic-Goals-Hypoglycemia-and-Hyperglycemic)
- [CDC：糖尿病前期与 2 型糖尿病预防](https://www.cdc.gov/diabetes/prevention-type-2/prediabetes-prevent-type-2.html)`;

  return {
    riskLevel,
    classification,
    confidence: metrics.confidence,
    needsManualReview,
    bmi,
    homaIr,
    reportMarkdown: reportWithSources,
  };
};

export const analyzeOgtt = async (input: z.infer<typeof ogttRequestSchema>) => {
  const extracted = input.imageDataUrl
    ? await extractMetrics(input.imageDataUrl)
    : emptyMetrics;
  const metrics = mergeMetrics(extracted, input.manualMetrics);
  const analysis = buildOgttAnalysis(metrics, input.profile);
  const id = generateId();

  try {
    await db.insert(ogttAnalysis).values({
      id,
      source: input.imageDataUrl ? "screenshot" : "manual",
      riskLevel: analysis.riskLevel,
      classification: analysis.classification,
      confidence: analysis.confidence,
      needsManualReview: analysis.needsManualReview,
      glucoseUnit: metrics.glucoseUnit,
      extractedMetrics: metrics,
      profile: input.profile,
      reportMarkdown: analysis.reportMarkdown,
      imageStored: false,
    });
  } catch (error) {
    console.error("OGTT analysis could not be persisted", error);
  }

  return {
    id,
    metrics,
    ...analysis,
    privacy: "原始截图未保存；后台仅保留脱敏后的指标和分析结果。",
  };
};
