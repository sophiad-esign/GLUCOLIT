import { describe, expect, it } from "vitest";

import { parseFoodModelResult } from "./food";

const modelResult = {
  isFoodImage: true,
  mealSummary: "米饭、鸡肉和青菜组成的一餐。",
  foods: [
    {
      name: "米饭",
      estimatedPortion: "约半碗到一碗",
      category: "staple",
      confidence: 86,
    },
  ],
  caloriesKcal: { min: 650, max: 450 },
  carbsGrams: { min: 55, max: 80 },
  proteinGrams: { min: 20, max: 30 },
  fatGrams: { min: 12, max: 25 },
  fiberGrams: { min: 5, max: 9 },
  estimatedCarbs: "主要来自米饭。",
  estimatedProtein: "主要来自鸡肉。",
  estimatedFiber: "青菜提供部分纤维。",
  plateBalanceScore: 72,
  glycemicLoad: "medium",
  strengths: ["有蛋白质和非淀粉类蔬菜。"],
  concerns: ["米饭份量无法从单张照片准确称量。"],
  actions: ["下一餐先吃蔬菜和蛋白质，再吃主食。"],
  uncertainties: ["烹调油和酱汁用量不可见。"],
};

describe("food model result validation", () => {
  it("normalizes confidence percentages and reversed nutrient ranges", () => {
    const parsed = parseFoodModelResult(JSON.stringify(modelResult));

    expect(parsed.foods[0]?.confidence).toBe(0.86);
    expect(parsed.caloriesKcal).toEqual({ min: 450, max: 650 });
  });

  it("accepts JSON fenced by a model", () => {
    const parsed = parseFoodModelResult(
      `\`\`\`json\n${JSON.stringify(modelResult)}\n\`\`\``,
    );

    expect(parsed.glycemicLoad).toBe("medium");
    expect(parsed.actions).toHaveLength(1);
  });

  it("rejects a response without calorie and nutrient ranges", () => {
    const incomplete = { ...modelResult } as Partial<typeof modelResult>;
    delete incomplete.caloriesKcal;

    expect(() => parseFoodModelResult(JSON.stringify(incomplete))).toThrowError(
      "expected object",
    );
  });
});
