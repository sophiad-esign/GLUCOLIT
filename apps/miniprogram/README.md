# GLUCOLIT 微信小程序

GLUCOLIT 是面向糖尿病前期与代谢健康管理场景的 Taro 微信小程序 MVP。

当前版本包含：

- 首页：健康概览、健康分、24 小时趋势示意、饮食/睡眠/运动摘要
- AI：报告解读、餐盘分析、食品配料表分析
- 行动：每日一项核心行动、降级方案、打卡及生活方式记录
- 指南：饮食、运动与睡眠文章，并保留来源
- 我的：隐私说明、本机数据概览与一键删除
- 手动记录：饮食餐次、睡眠、运动、空腹及餐后 2 小时血糖

所有模型密钥仅配置在服务端。原始报告、餐食和食品标签图片仅用于当次分析，不写入应用数据库或对象存储。

## 架构

- 小程序：Taro 4 + React
- API：Hono/Next.js，部署于 `https://glucolit.vercel.app`
- 多模态模型：Kimi 或 OpenAI，由服务端环境变量选择
- 本机数据：微信小程序 Storage，可由用户在“我的”页面删除

## 本地构建

在仓库根目录执行：

```powershell
pnpm --filter miniprogram typecheck
pnpm --filter miniprogram build
```

构建产物位于 `apps/miniprogram/dist`。

## 微信开发者工具导入

1. 安装并登录微信开发者工具稳定版。
2. 选择“导入项目”。
3. 项目目录选择 `apps/miniprogram`；工具会按照 `project.config.json` 使用 `dist/`。
4. 将 `project.config.json` 中的 `touristappid` 替换为真实小程序 AppID。
5. 开发阶段可在“本地设置”中临时关闭合法域名校验。
6. 体验版和正式版必须在微信公众平台配置：
   - request 合法域名：生产 API 的 HTTPS 主域名
   - uploadFile 合法域名：生产 API 的 HTTPS 主域名
7. 在模拟器与真机分别验证首页、三类上传、行动打卡、指南和数据删除。

默认 API：

```text
https://glucolit.vercel.app/api
```

本地联调：

```powershell
$env:TARO_APP_API_BASE_URL="http://localhost:3000/api"
pnpm --filter miniprogram dev
```

## 服务端环境变量

生产环境至少配置：

```text
KIMI_API_KEY=...
KIMI_BASE_URL=https://api.moonshot.ai/v1
KIMI_VISION_MODEL=kimi-k2.5
```

也可改用：

```text
OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-4.1-mini
```

密钥不得出现在小程序源码、构建产物、Git 仓库或客户端请求中。

## 体验二维码

1. 使用真实 AppID 导入并完成真机预览。
2. 由有上传权限的项目成员上传代码。
3. 在微信公众平台将测试微信号加入体验成员。
4. 选择该代码版本为体验版并生成二维码。

没有真实 AppID、项目成员权限、合法请求域名和微信开发者工具时，不能生成有效的官方体验版二维码。
