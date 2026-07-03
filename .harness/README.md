# Harness 部署

`deploy-api.yaml` 使用 Harness Cloud 完成两件事：

1. 安装锁定版本依赖，执行 API 测试、小程序类型检查和构建。
2. 使用 Vercel CLI 发布承载 `/api/ai/food-upload` 的 Next.js 服务。

之所以保留 Vercel 作为运行环境，是因为当前 API 已集成在 Next.js/Hono 路由中；Harness 负责持续集成、质量门禁和部署编排。这样不需要为了 Demo 额外维护 Kubernetes 集群。

## Harness 中需要准备

- Git 代码仓库 Connector。
- 项目级或组织级 Secret：`VERCEL_TOKEN`。
- 项目级或组织级 Secret：`OPENAI_API_KEY`。
- 已关联当前仓库的 Vercel 项目。
- Harness Cloud 可用额度；免费账户可能需要先完成账户验证。

将 `deploy-api.yaml` 粘贴到 Harness Pipeline Studio 的 YAML 编辑器，依次填写组织、项目、代码仓库 Connector、仓库名和构建分支。第一次运行前，在 Vercel 项目中确认 `OPENAI_API_KEY` 和可选的 `OPENAI_VISION_MODEL` 已配置到 Production 环境。

部署后验证：

```powershell
Invoke-WebRequest https://glucolit.vercel.app/api/status
```

餐食接口是 `POST /api/ai/food-upload`，字段名为 `image`，同时提交：

```text
consent=true
mealType=unknown
goal=glucose
notes=
```

不要把 OpenAI、Kimi、Vercel 或 Harness 密钥放进小程序代码、构建变量或二维码。
