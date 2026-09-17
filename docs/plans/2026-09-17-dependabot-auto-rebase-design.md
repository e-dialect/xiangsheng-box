# Dependabot 自动跟随 main 设计

## 目标

让 Dependabot 创建的开放 PR 在 `main` 更新后主动 rebase，并重新执行现有 CI，从而满足仓库 `strict: true` 的分支保护要求。该机制不得绕过状态检查、代码所有者审查或会话解决规则，也不应修改普通贡献者的分支。

## 方案

在 `.github/dependabot.yml` 的 pip、npm 和 GitHub Actions 三个更新源中显式设置 `rebase-strategy: auto`，并将检查频率从每周调整为每日。这保留 GitHub 原生 Dependabot 行为，也为偶发的 workflow 失败提供每日兜底。

新增 `.github/workflows/dependabot-rebase.yml`。当 `main` 收到 push 时，workflow 使用仓库自带的 `GITHUB_TOKEN` 查询作者为 `app/dependabot` 的开放 PR，并逐个发布官方支持的 `@dependabot rebase` 命令。workflow 也提供 `workflow_dispatch`，方便维护者手动补跑。权限只开放 `contents: read`、`pull-requests: read` 和发布 PR 会话评论所需的 `issues: write`；不授予代码写入、Actions 管理或管理员权限。并发组会合并重复触发，避免短时间连续合并造成重复命令。

Dependabot 完成 rebase 后会生成新的头提交，现有 pull-request CI 会重新运行。仓库启用的 `dismiss_stale_reviews` 会让旧批准失效，因此自动更新不会把过期审查带入合并。workflow 仅处理 Dependabot PR；普通贡献者 PR 仍由作者自行更新。

## 验证

静态验证 YAML 可解析、Dependabot 三个更新源均启用 `auto` 且为每日计划、workflow 触发器和最小权限正确。合并后通过手动触发或下一次 `main` push，确认开放 Dependabot PR 收到命令、头 SHA 更新并重新运行 CI。
