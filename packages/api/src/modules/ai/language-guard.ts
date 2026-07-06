const replacements: [RegExp, string][] = [
  [/逆转/gu, "改善"],
  [/根治/gu, "长期管理"],
  [/降血糖|控糖/gu, "帮助维持更平稳的餐后状态"],
  [/预防糖尿病/gu, "降低相关健康风险"],
  [/胰岛素抵抗/gu, "代谢状态"],
  [/减肥|减脂/gu, "体重管理"],
  [/100%/gu, "较高把握"],
  [/最佳|最好|最健康|最适合/gu, "更合适"],
];

export const neutralizeHealthClaims = (value: string) =>
  replacements.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value,
  );

export const neutralizeModelStrings = <T>(value: T): T => {
  if (typeof value === "string") {
    return neutralizeHealthClaims(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => neutralizeModelStrings(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        neutralizeModelStrings(item),
      ]),
    ) as T;
  }
  return value;
};
