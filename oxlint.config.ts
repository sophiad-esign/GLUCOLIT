import { defineConfig } from "oxlint";

import baseConfig from "@workspace/oxlint/base";

export default defineConfig({
  extends: [baseConfig],
  options: {
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    {
      files: ["apps/miniprogram/**/*.{ts,tsx}"],
      rules: {
        "i18next/no-literal-string": "off",
      },
    },
  ],
});
