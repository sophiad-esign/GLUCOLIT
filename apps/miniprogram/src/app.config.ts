export default defineAppConfig({
  pages: [
    "pages/home/index",
    "pages/articles/index",
    "pages/tools/index",
    "pages/records/index",
    "pages/companion/index",
    "pages/profile/index",
    "pages/article/index",
  ],
  window: {
    navigationBarTitleText: "GLUCOLIT",
    navigationBarBackgroundColor: "#ffffff",
    navigationBarTextStyle: "black",
    backgroundColor: "#f5f7fa",
  },
  tabBar: {
    color: "#718078",
    selectedColor: "#0e5c43",
    backgroundColor: "#fffef8",
    borderStyle: "white",
    list: [
      { pagePath: "pages/home/index", text: "首页" },
      { pagePath: "pages/tools/index", text: "AI" },
      { pagePath: "pages/records/index", text: "行动" },
      { pagePath: "pages/articles/index", text: "指南" },
    ],
  },
  permission: {
    "scope.camera": { desc: "用于拍摄餐食或体检报告进行分析" },
  },
});
