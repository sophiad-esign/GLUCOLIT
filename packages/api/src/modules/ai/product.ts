import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

const text = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim().slice(0, max) : ""),
    z.string().min(1),
  );

const productResultSchema = z.object({
  productName: text(120),
  summary: text(500),
  suitability: z.enum(["often", "sometimes", "rarely", "uncertain"]),
  addedSugar: z.enum(["none-visible", "low", "medium", "high", "uncertain"]),
  refinedCarbs: z.enum(["low", "medium", "high", "uncertain"]),
  protein: text(300),
  fiber: text(300),
  keyIngredients: z.array(text(120)).max(12).catch([]),
  strengths: z.array(text(240)).max(6).catch([]),
  concerns: z.array(text(240)).max(6).catch([]),
  shoppingAdvice: z.array(text(300)).min(1).max(6),
  uncertainties: z.array(text(240)).max(6).catch([]),
});

export const productAnalysisRequestSchema = z.object({
  imageDataUrl: z
    .string()
    .max(7_000_000)
    .refine(
      (value) => /^data:image\/(png|jpeg|webp);base64,/.test(value),
      "Only PNG, JPEG, and WebP photos are supported.",
    ),
  consent: z.literal(true),
});

const model = () => {
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

export const parseProductModelResult = (value: string) =>
  productResultSchema.parse(
    JSON.parse(
      value
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    ),
  );

export const analyzeProduct = async (
  input: z.infer<typeof productAnalysisRequestSchema>,
) => {
  const { text: result } = await generateText({
    model: model(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `你是注册营养师的食品标签阅读助手。只根据图片中清晰可见的配料表和营养成分表进行判断，不猜测看不清的文字。
重点识别配料排序、添加糖或糖浆、精制碳水、蛋白质、膳食纤维以及每份或每100毫升的营养信息。
给出适合日常选购的中性建议，不诊断疾病，不承诺降糖、减重或治疗效果。
所有面向用户的字符串必须使用自然、清晰的简体中文。
只返回 JSON，且恰好包含：
productName, summary, suitability, addedSugar, refinedCarbs, protein, fiber,
keyIngredients, strengths, concerns, shoppingAdvice, uncertainties。
suitability 只能是 often、sometimes、rarely、uncertain；
addedSugar 只能是 none-visible、low、medium、high、uncertain；
refinedCarbs 只能是 low、medium、high、uncertain。`,
          },
          { type: "image", image: input.imageDataUrl },
        ],
      },
    ],
  });

  return {
    ...parseProductModelResult(result),
    privacy: "原始食品标签照片不会保存。",
  };
};
