import { describe, expect, it } from "vitest";

import { parseProductModelResult } from "./product";

describe("product label result validation", () => {
  it("accepts a structured Chinese shopping result", () => {
    const result = parseProductModelResult(
      JSON.stringify({
        productName: "原味燕麦饮",
        summary: "配料较简洁，但蛋白质和膳食纤维信息需要结合营养成分表确认。",
        suitability: "sometimes",
        addedSugar: "none-visible",
        refinedCarbs: "medium",
        protein: "包装显示的蛋白质含量较低。",
        fiber: "图片中未清晰显示膳食纤维数值。",
        keyIngredients: ["水", "燕麦"],
        strengths: ["未在可见配料中发现添加糖"],
        concerns: ["蛋白质含量较低"],
        shoppingAdvice: ["与无糖高蛋白产品对比后再选择"],
        uncertainties: ["部分营养成分数值有反光"],
      }),
    );

    expect(result.productName).toBe("原味燕麦饮");
    expect(result.suitability).toBe("sometimes");
    expect(result.shoppingAdvice).toHaveLength(1);
  });

  it("normalizes a single shopping recommendation into a list", () => {
    const result = parseProductModelResult(
      JSON.stringify({
        productName: "植物饮料",
        summary: "图片信息有限。",
        suitability: "uncertain",
        addedSugar: "uncertain",
        refinedCarbs: "uncertain",
        protein: "无法确认。",
        fiber: "无法确认。",
        keyIngredients: "水",
        strengths: [],
        concerns: [],
        shoppingAdvice: "补拍清晰的营养成分表。",
        uncertainties: "营养成分表文字较小。",
      }),
    );

    expect(result.keyIngredients).toEqual(["水"]);
    expect(result.shoppingAdvice).toEqual(["补拍清晰的营养成分表。"]);
  });
});
