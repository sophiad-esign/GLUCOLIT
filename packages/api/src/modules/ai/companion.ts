import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

const checkinSchema = z.object({
  date: z.string().max(20),
  mood: z.number().int().min(1).max(5),
  difficulty: z.number().int().min(1).max(5),
  trigger: z.string().max(80),
  note: z.string().max(500),
  smallestAction: z.string().max(200),
});

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(1000),
});

export const companionRequestSchema = z.object({
  mode: z.enum(["checkin", "sos", "chat", "restart", "weekly"]),
  message: z.string().trim().max(1200).default(""),
  dayNumber: z.number().int().min(1).max(365).default(1),
  checkins: z.array(checkinSchema).max(14).default([]),
  recentMessages: z.array(chatMessageSchema).max(8).default([]),
});

const responseSchema = z.object({
  reply: z.string().min(1).max(2500),
  nextAction: z.string().min(1).max(300),
  affirmation: z.string().min(1).max(300),
});

const crisisPatterns = [
  /不想活|想死|自杀|结束生命|活着没意义|没有活下去|伤害自己|自残/,
  /kill myself|suicide|want to die|end my life|hurt myself/i,
];

const crisisResponse = {
  crisis: true,
  reply:
    "我很在意你刚才说的话。现在最重要的不是饮食、运动或完成计划，而是先保证你的安全。请立即联系身边可信任的人陪着你，不要独处，并远离可能伤害自己的物品。如果你已经制定计划、准备行动或无法保证安全，请立即拨打当地急救电话；在中国大陆可拨打 120 或 110，其他地区请联系当地急救或危机热线。",
  nextAction: "现在就联系一位可信任的人，并明确告诉对方：我现在需要你陪着我。",
  affirmation: "求助不是失败，而是在保护自己。你不需要独自扛住这一刻。",
};

const getModel = () => {
  if (process.env.KIMI_API_KEY) {
    return createOpenAI({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
      name: "kimi",
    }).chat(process.env.KIMI_COMPANION_MODEL || "moonshot-v1-8k");
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses(
      process.env.OPENAI_COMPANION_MODEL || "gpt-4.1-mini",
    );
  }
  throw new Error("KIMI_API_KEY or OPENAI_API_KEY is required");
};

const parseJson = (text: string) =>
  responseSchema.parse(
    JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    ),
  );

const modeInstruction = {
  checkin:
    "Reflect the emotion without judgment, identify one strength, and turn the user's chosen smallest action into a realistic implementation intention.",
  sos: "Use a three-minute urge-surfing style response: pause, name the trigger, reduce the goal, offer one immediate alternative, and make a short follow-up agreement. Never shame.",
  chat: "Respond as a warm behavior-change companion using reflective listening and motivational interviewing. Ask at most one useful question and avoid generic praise.",
  restart:
    "Create a compassionate restart plan for the next meal or next 24 hours. Separate the trigger from identity, preserve prior progress, and give exactly three small steps.",
  weekly:
    "Summarize the last seven days: emotional pattern, common trigger, demonstrated strength, goal that may be too ambitious, and one or two priorities for next week.",
} as const;

export const respondAsCompanion = async (
  input: z.infer<typeof companionRequestSchema>,
) => {
  const safetyText = [
    input.message,
    ...input.recentMessages.map((message) => message.content),
  ].join(" ");
  if (crisisPatterns.some((pattern) => pattern.test(safetyText))) {
    return crisisResponse;
  }

  const { text } = await generateText({
    model: getModel(),
    messages: [
      {
        role: "system",
        content: `You are GLUCOLIT 同行, a Chinese behavior-change companion for adults following a DPP-style prediabetes lifestyle program.
You are not a therapist or doctor. Do not diagnose, promise reversal, prescribe medication, recommend extreme dieting, fasting, purging, or excessive exercise.
Do not call normal habit-change discomfort a medical withdrawal syndrome.
Use natural Simplified Chinese. Validate feelings before suggesting action. Treat lapses as information, never as failure. Preserve autonomy and make actions tiny and specific.
If the user mentions self-harm, suicide, wanting to die, or inability to stay safe, do not provide routine coaching; instruct immediate human and emergency support.
Return JSON only with keys reply, nextAction, affirmation. No Markdown fences.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task: modeInstruction[input.mode],
          programDay: input.dayNumber,
          message: input.message,
          checkins: input.checkins,
          recentConversation: input.recentMessages,
        }),
      },
    ],
  });

  return { crisis: false, ...parseJson(text) };
};
