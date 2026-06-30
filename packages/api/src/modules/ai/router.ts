import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";
import { desc } from "drizzle-orm";
import { Hono } from "hono";

import { ogttAnalysis } from "@workspace/db/schema";
import { db } from "@workspace/db/server";

import { enforceAdmin, enforceAuth, validate } from "../../middleware";
import { analyzeFood, foodAnalysisRequestSchema } from "./food";
import { analyzeOgtt, ogttRequestSchema } from "./ogtt";

import type { UIMessage } from "ai";

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
  .get("/ogtt", enforceAuth, enforceAdmin, async (c) => {
    const analyses = await db
      .select()
      .from(ogttAnalysis)
      .orderBy(desc(ogttAnalysis.createdAt))
      .limit(100);

    return c.json({ analyses });
  });
