export default defineAppConfig({
  pages: [
    "pages/home/index",
    "pages/articles/index",
    "pages/tools/index",
    "pages/records/index",
    "pages/companion/index",
    "pages/article/index",
  ],
  window: {
    navigationBarTitleText: "GLUCOLIT",
    navigationBarBackgroundColor: "#ffffff",
    navigationBarTextStyle: "black",
    backgroundColor: "#f5f7fa",
  },
  tabBar: {
    color: "#667085",
    selectedColor: "#f04b13",
    backgroundColor: "#ffffff",
    list: [
      { pagePath: "pages/home/index", text: "首页" },
      { pagePath: "pages/articles/index", text: "科普" },
      { pagePath: "pages/tools/index", text: "AI工具" },
      { pagePath: "pages/records/index", text: "记录" },
      { pagePath: "pages/companion/index", text: "同行" },
    ],
  },
  permission: {
    "scope.camera": { desc: "用于拍摄餐食或体检报告进行分析" },
  },
});
