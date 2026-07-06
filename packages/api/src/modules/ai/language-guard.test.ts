import { describe, expect, it } from "vitest";

import {
  neutralizeHealthClaims,
  neutralizeModelStrings,
} from "./language-guard";

describe("health claim language guard", () => {
  it("replaces public-facing treatment and efficacy claims", () => {
    expect(neutralizeHealthClaims("这是最适合控糖并逆转胰岛素抵抗的选择")).toBe(
      "这是更合适帮助维持更平稳的餐后状态并改善代谢状态的选择",
    );
  });

  it("walks nested model output", () => {
    expect(
      neutralizeModelStrings({
        summary: "有助于预防糖尿病",
        actions: ["用于减脂", "不是100%准确"],
      }),
    ).toEqual({
      summary: "有助于降低相关健康风险",
      actions: ["用于体重管理", "不是较高把握准确"],
    });
  });
});
