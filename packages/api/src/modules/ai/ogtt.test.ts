import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL ||= "postgres://test:test@localhost:5432/test";

let buildOgttAnalysis: typeof import("./ogtt").buildOgttAnalysis;

beforeAll(async () => {
  ({ buildOgttAnalysis } = await import("./ogtt"));
});

const metrics = (overrides: Record<string, unknown> = {}) => ({
  glucoseUnit: "mmol/L" as const,
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
  ...overrides,
});

describe("OGTT deterministic classification", () => {
  it("classifies fasting prediabetes range", () => {
    expect(
      buildOgttAnalysis(metrics({ fastingGlucose: 6.1 }), {}).riskLevel,
    ).toBe("prediabetes");
  });

  it("classifies two-hour impaired glucose tolerance", () => {
    expect(buildOgttAnalysis(metrics({ glucose120: 8.2 }), {}).riskLevel).toBe(
      "prediabetes",
    );
  });

  it("classifies diabetes range", () => {
    expect(buildOgttAnalysis(metrics({ glucose120: 11.1 }), {}).riskLevel).toBe(
      "diabetes-range",
    );
  });

  it("converts mg/dL before classification", () => {
    expect(
      buildOgttAnalysis(
        metrics({ glucoseUnit: "mg/dL", fastingGlucose: 105 }),
        {},
      ).riskLevel,
    ).toBe("prediabetes");
  });

  it("uses HbA1c threshold", () => {
    expect(buildOgttAnalysis(metrics({ hba1c: 5.9 }), {}).riskLevel).toBe(
      "prediabetes",
    );
  });

  it("does not apply adult thresholds during pregnancy", () => {
    expect(
      buildOgttAnalysis(metrics({ glucose120: 9 }), { pregnancy: true })
        .riskLevel,
    ).toBe("needs-review");
  });
});
