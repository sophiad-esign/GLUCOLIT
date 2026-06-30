import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

const numberFromModel = z.preprocess((value) => {
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}, z.number().finite().nonnegative());

const modelText = (max: number) =>
  z.preprocess(
    (value) =>
      (typeof value === "string" || typeof value === "number"
        ? String(value)
        : ""
      )
        .trim()
        .slice(0, max),
    z.string().min(1),
  );

const foodItemSchema = z.object({
  name: modelText(80),
  estimatedPortion: modelText(120),
  category: z
    .enum(["staple", "protein", "vegetable", "fruit", "fat", "drink", "other"])
    .catch("other"),
  confidence: numberFromModel.transform((value) =>
    Math.min(1, value > 1 ? value / 100 : value),
  ),
});

const modelResultSchema = z.object({
  isFoodImage: z.boolean().catch(true),
  mealSummary: modelText(500),
  foods: z.array(foodItemSchema).max(20).catch([]),
  estimatedCarbs: modelText(500),
  estimatedProtein: modelText(500),
  estimatedFiber: modelText(500),
  plateBalanceScore: numberFromModel.transform((value) => Math.min(100, value)),
  glycemicLoad: z
    .enum(["low", "medium", "high", "uncertain"])
    .catch("uncertain"),
  strengths: z.array(modelText(300)).max(6).catch([]),
  concerns: z.array(modelText(300)).max(6).catch([]),
  actions: z.array(modelText(400)).min(1).max(6),
  uncertainties: z.array(modelText(300)).max(8).catch([]),
});

export const foodAnalysisRequestSchema = z.object({
  imageDataUrl: z
    .string()
    .max(7_000_000)
    .refine(
      (value) => /^data:image\/(png|jpeg|webp);base64,/.test(value),
      "Only PNG, JPEG, and WebP photos are supported.",
    ),
  mealType: z
    .enum(["breakfast", "lunch", "dinner", "snack", "unknown"])
    .default("unknown"),
  goal: z.enum(["glucose", "weight", "balanced"]).default("glucose"),
  notes: z.string().trim().max(300).optional(),
  consent: z.literal(true),
});

const getVisionModel = () => {
  if (process.env.KIMI_API_KEY) {
    return createOpenAI({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
      name: "kimi",
    }).chat(process.env.KIMI_VISION_MODEL || "kimi-k2.5");
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses(
      process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
    );
  }
  throw new Error("KIMI_API_KEY or OPENAI_API_KEY is required");
};

const parseJson = (text: string) =>
  modelResultSchema.parse(
    JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    ),
  );

const list = (items: string[], fallback: string) =>
  (items.length ? items : [fallback]).map((item) => `- ${item}`).join("\n");

export const analyzeFood = async (
  input: z.infer<typeof foodAnalysisRequestSchema>,
) => {
  const { text } = await generateText({
    model: getVisionModel(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are assisting a registered dietitian with photo-based meal education for an adult with prediabetes.
Analyze only what is visibly supported. Never claim exact calories, grams, ingredients, cooking oil, sugar, sodium, or portion weight from an image.
Estimate portions as ranges or visual household measures and explicitly list uncertainty.
Assess carbohydrate quality and amount, protein, non-starchy vegetables, fiber, sugary drinks, sauces, and cooking method.
Use a practical plate method: about half non-starchy vegetables, one quarter protein, one quarter high-fiber staple where appropriate.
Give specific swaps and eating-order suggestions. Do not prescribe medication, supplements, fasting, extreme low-carb diets, or diagnose disease.
Meal type: ${input.mealType}. User goal: ${input.goal}. User note: ${input.notes || "none"}.
All user-facing string values must be written in clear, natural Simplified Chinese, including food names, portions, summaries, strengths, concerns, actions, and uncertainties.
Return JSON only with exactly these keys:
isFoodImage, mealSummary, foods, estimatedCarbs, estimatedProtein, estimatedFiber,
plateBalanceScore, glycemicLoad, strengths, concerns, actions, uncertainties.
foods items use keys name, estimatedPortion, category, confidence.
category must be staple, protein, vegetable, fruit, fat, drink, or other.
glycemicLoad must be low, medium, high, or uncertain.
plateBalanceScore is 0-100. confidence is 0-1.`,
          },
          { type: "image", image: input.imageDataUrl },
        ],
      },
    ],
  });

  const result = parseJson(text);
  if (!result.isFoodImage || result.foods.length === 0) {
    return {
      ...result,
      status: "needs-review" as const,
      reportMarkdown:
        "## 暂时无法确认这是一份餐食\n\n请重新拍摄完整餐盘，保持光线充足，并尽量让主食、菜肴和饮料都出现在画面中。",
      privacy: "原始餐食照片不会保存。",
    };
  }

  const loadLabel = {
    low: "较低",
    medium: "中等",
    high: "较高",
    uncertain: "无法可靠判断",
  }[result.glycemicLoad];
  const foodRows = result.foods
    .map(
      (food) =>
        `| ${food.name} | ${food.estimatedPortion} | ${Math.round(food.confidence * 100)}% |`,
    )
    .join("\n");

  return {
    ...result,
    status:
      result.glycemicLoad === "high"
        ? ("attention" as const)
        : ("reviewed" as const),
    reportMarkdown: `## 这餐看起来有什么

${result.mealSummary}

| 识别食物 | 目测份量 | 识别把握 |
| --- | --- | ---: |
${foodRows}

## 营养结构估算

- **碳水化合物：** ${result.estimatedCarbs}
- **蛋白质：** ${result.estimatedProtein}
- **膳食纤维：** ${result.estimatedFiber}
- **餐盘平衡度：** ${Math.round(result.plateBalanceScore)}/100
- **本餐升糖负荷：** ${loadLabel}

## 做得不错

${list(result.strengths, "照片信息有限，暂时没有足够把握评价优势。")}

## 糖前期需要留意

${list(result.concerns, "暂未发现明确问题，但照片不能替代称量和营养成分表。")}

## 下一餐可以直接这样改

${result.actions.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## 照片无法确定的部分

${list(result.uncertainties, "烹调油、调味糖和实际重量无法仅凭照片准确判断。")}

> 本结果是基于照片的营养教育估算，不是精确热量计算、诊断或个体化医疗营养处方。若正在使用降糖药、怀孕、存在肾病或有低血糖史，请由医生或注册营养师制定方案。`,
    privacy: "原始餐食照片不会保存。",
  };
};
