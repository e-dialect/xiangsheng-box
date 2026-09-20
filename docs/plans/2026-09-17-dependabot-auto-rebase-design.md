# Dependabot 自动跟随 main 设计

## 目标

让 Dependabot 创建的开放 PR 自动 rebase，并重新执行现有 CI，从而满足仓库 `strict: true` 的分支保护要求。该机制不得绕过状态检查、代码所有者审查或会话解决规则，也不应修改普通贡献者的分支。

## 方案

在 `.github/dependabot.yml` 的 pip、npm 和 GitHub Actions 三个更新源中显式设置 `rebase-strategy: auto`，并将检查频率从每周调整为每日。Dependabot 会在每日更新检查、PR 重开、目标分支变化以及目标分支更新后产生冲突时检查并执行 rebase。

不使用 GitHub Actions 发布 `@dependabot rebase` 评论。Dependabot 当前拒绝来自 GitHub App 的评论命令，即使该 App 具有 `contents: write`，`github-actions[bot]` 仍会收到“only users with push access”错误。让工作流冒充维护者需要长期保存个人访问令牌，会扩大凭据泄露和权限滥用风险，因此仓库只使用 GitHub 原生自动 rebase。需要立即更新而不等待每日检查时，由具有写权限的维护者手动发布 `@dependabot rebase`。

Dependabot 完成 rebase 后会生成新的头提交，现有 pull-request CI 会重新运行。仓库启用的 `dismiss_stale_reviews` 会让旧批准失效，因此自动更新不会把过期审查带入合并。普通贡献者 PR 仍由作者自行更新。

## 验证

静态验证 YAML 可解析、Dependabot 三个更新源均启用 `auto` 且为每日计划，并确认不存在会以 GitHub App 身份发布无效命令的 workflow。对当前开放 PR 由维护者一次性发布命令，确认 Dependabot 用点赞反应接受、头 SHA 更新并重新运行 CI。
