# GLUCOLIT 微信小程序

这是一个可拍照或从相册选择菜品图片的 Taro 微信小程序。图片会上传到服务端，经视觉模型识别后返回：

- 菜品与目测份量
- 热量、碳水、蛋白质、脂肪和膳食纤维的估算区间
- 餐盘平衡分和升糖负荷提示
- 面向糖尿病前期/血糖管理的一般性饮食建议
- 照片无法确定的因素与医疗免责声明

原始图片仅用于本次分析，不写入数据库或对象存储。模型密钥只配置在 API 服务端，绝不能写入小程序。

## 本地运行

1. 在微信公众平台注册测试或正式小程序，复制 AppID 到 `project.config.json`。
2. 在仓库根目录运行 `pnpm install`。
3. 运行 `pnpm --filter miniprogram dev`。
4. 用微信开发者工具导入本目录，构建目录选择 `dist`。

默认 API 地址为 `https://glucolit.vercel.app/api`。本地联调时可设置：

```powershell
$env:TARO_APP_API_BASE_URL="http://localhost:3000/api"
pnpm --filter miniprogram dev
```

开发者工具联调本地 HTTP 服务时需要临时关闭合法域名校验；体验版必须使用 HTTPS，并把 API 主域名同时加入 `request` 和 `uploadFile` 合法域名。

## 服务端配置

在 API 部署环境中至少配置一个视觉模型提供商：

```text
OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-4.1-mini
```

或：

```text
KIMI_API_KEY=...
KIMI_BASE_URL=https://api.moonshot.ai/v1
KIMI_VISION_MODEL=kimi-k2.5
```

## 生成体验版

1. 将 `project.config.json` 中的 `touristappid` 替换为真实 AppID。
2. 构建并在微信开发者工具中完成真机预览。
3. 由有上传权限的项目成员上传代码。
4. 在微信公众平台将测试微信号加入体验成员，并生成体验版二维码。

没有真实 AppID、项目成员权限和微信上传私钥时，只能生成开发者工具本地预览码，无法代替官方体验版二维码。
