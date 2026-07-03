import { defineConfig } from "@tarojs/cli";

export default defineConfig({
  projectName: "glucolit-miniprogram",
  date: "2026-07-02",
  designWidth: 750,
  sourceRoot: "src",
  outputRoot: "dist",
  framework: "react",
  compiler: "webpack5",
  mini: {
    postcss: {
      pxtransform: { enable: true },
      cssModules: { enable: false },
    },
  },
});
