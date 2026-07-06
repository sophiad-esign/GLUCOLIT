import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";
import { desc } from "drizzle-orm";
import { Hono } from "hono";
import { Buffer } from "node:buffer";

import { ogttAnalysis } from "@workspace/db/schema";
import { db } from "@workspace/db/server";

import { enforceAdmin, enforceAuth, validate } from "../../middleware";
import { companionRequestSchema, respondAsCompanion } from "./companion";
import { analyzeFood, foodAnalysisRequestSchema } from "./food";
import { analyzeLifestyle, lifestyleAnalysisRequestSchema } from "./lifestyle";
import { analyzeOgtt, ogttRequestSchema } from "./ogtt";
import { analyzeProduct, productAnalysisRequestSchema } from "./product";

import type { UIMessage } from "ai";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const uploadedImageDataUrl = async (value: FormDataEntryValue | undefined) => {
  if (!(value instanceof File)) {
    throw new Error("请选择要上传的图片。");
  }
  if (!IMAGE_TYPES.has(value.type)) {
    throw new Error("仅支持 JPEG、PNG 或 WebP 图片。");
  }
  if (value.size > MAX_UPLOAD_BYTES) {
    throw new Error("图片不能超过 5MB，请压缩后重试。");
  }

  const encoded = Buffer.from(await value.arrayBuffer()).toString("base64");
  return `data:${value.type};base64,${encoded}`;
};

const jsonField = (form: FormData, key: string, fallback: unknown) => {
  const value = form.get(key);
  if (typeof value !== "string" || !value.trim()) return fallback;
  return JSON.parse(value);
};

export const aiRouter = new Hono()
  .post("/chat", enforceAuth, async (c) => {
    const { messages }: { messages: UIMessage[] } = await c.req.json();

    return streamText({
      model: openai.responses("gpt-4.1-nano"),
      messages: await convertToModelMessages(messages),
    }).toUIMessageStreamResponse();
  })
  .post("/ogtt", validate("json", ogttRequestSchema), async (c) => {
    try {
      return c.json(await analyzeOgtt(c.req.valid("json")));
    } catch (error) {
      console.error("OGTT screenshot analysis failed", error);
      return c.json(
        {
          error:
            "截图识别暂时不可用。请核对图片清晰度，或切换到手动录入指标后继续分析。",
        },
        422,
      );
    }
  })
  .post("/food", validate("json", foodAnalysisRequestSchema), async (c) => {
    try {
      return c.json(await analyzeFood(c.req.valid("json")));
    } catch (error) {
      console.error("Food photo analysis failed", error);
      return c.json(
        {
          error: "餐食识别暂时失败。请确认照片清晰、完整包含餐盘后重试。",
        },
        422,
      );
    }
  })
  .post("/food-upload", async (c) => {
    try {
      const form = await c.req.formData();
      const input = foodAnalysisRequestSchema.parse({
        imageDataUrl: await uploadedImageDataUrl(
          form.get("image") ?? undefined,
        ),
        mealType: form.get("mealType") || "unknown",
        goal: form.get("goal") || "glucose",
        notes: form.get("notes") || undefined,
        consent: form.get("consent") === "true",
      });
      return c.json(await analyzeFood(input));
    } catch (error) {
      console.error("Food upload analysis failed", error);
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "餐食识别暂时失败，请稍后重试。",
        },
        422,
      );
    }
  })
  .post("/product-upload", async (c) => {
    try {
      const form = await c.req.formData();
      const input = productAnalysisRequestSchema.parse({
        imageDataUrl: await uploadedImageDataUrl(
          form.get("image") ?? undefined,
        ),
        consent: form.get("consent") === "true",
      });
      return c.json(await analyzeProduct(input));
    } catch (error) {
      console.error("Product label analysis failed", error);
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "配料表识别暂时失败，请稍后重试。",
        },
        422,
      );
    }
  })
  .post("/ogtt-upload", async (c) => {
    try {
      const form = await c.req.formData();
      const input = ogttRequestSchema.parse({
        imageDataUrl: await uploadedImageDataUrl(
          form.get("image") ?? undefined,
        ),
        profile: jsonField(form, "profile", {}),
        consent: form.get("consent") === "true",
      });
      return c.json(await analyzeOgtt(input));
    } catch (error) {
      console.error("OGTT upload analysis failed", error);
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "报告识别暂时失败，请改用手动录入。",
        },
        422,
      );
    }
  })
  .post("/companion", validate("json", companionRequestSchema), async (c) => {
    try {
      return c.json(await respondAsCompanion(c.req.valid("json")));
    } catch (error) {
      console.error("Companion response failed", error);
      return c.json(
        {
          error: "陪伴回复暂时不可用。你可以先完成一个最小行动，稍后再试。",
        },
        422,
      );
    }
  })
  .post(
    "/lifestyle",
    validate("json", lifestyleAnalysisRequestSchema),
    async (c) => c.json(await analyzeLifestyle(c.req.valid("json"))),
  )
  .get("/ogtt", enforceAuth, enforceAdmin, async (c) => {
    const analyses = await db
      .select()
      .from(ogttAnalysis)
      .orderBy(desc(ogttAnalysis.createdAt))
      .limit(100);

    return c.json({ analyses });
  });
