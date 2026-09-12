# 贡献者上手指南

乡声集盒不是旧词典或社交信息流的简单搬家。第一次了解项目时，先按仓库 README 的顺序阅读长期产品路线、2027 春节冲刺和本指南；开始实现领域模型前，再阅读
[`PRODUCT_DESIGN.md`](PRODUCT_DESIGN.md)、[`ARCHITECTURE.md`](ARCHITECTURE.md) 和
[`adr/0006-entry-sense-recording-domain.md`](adr/0006-entry-sense-recording-domain.md)。

## 先理解四个任务

- 听：浏览真实录音并进入词条。
- 查：以词条为主结果，区分同形异读异义。
- 录：让不会写专业词条的母语者也能用最少信息提交。
- 我：管理资料、关注收藏、贡献履历、授权与隐私。

新功能使用 Entry / Recording V2 术语。不要新增 Can、Nameplate、Flavor、Package、
Shelf 等旧领域接口或页面；“罐头、盒子”可以是品牌意象，但不是数据模型名称。

## 推荐工作方式

实现任务必须以 Leaf Work Package 形式建立；Tracking / Epic 用于范围、依赖和决策汇总，其 Assignee 对拆分、风险、证据和 Gate 负责，不表示亲自完成全部实现。使用 AI 协助时必须遵循 [`AI_NATIVE_CONTRIBUTION.md`](AI_NATIVE_CONTRIBUTION.md)。Dialect Experience 与 Dialect Commons 是协作 Track，不构成目录或代码所有权边界。

1. 从用户任务和验收条件开始，确认普通母语者无需专业知识也能完成。
2. 后端先补模型或接口测试，再实现最小领域变化；只新增 forward migration。
3. 前端复用现有页面壳、基础组件、语义导航和 service，不在页面散落请求。
4. 地区选择必须允许停在父节点，普通页面不显示内部限定码。
5. 保留用户原话和来源证据；不要用支持数、积分或 AI 自动裁定语言事实。
6. 运行与风险相称的后端、前端、H5 和微信构建验证。

提交信息遵循 Conventional Commits。每个阶段使用独立分支和 PR，检查全绿后 squash
merge，保证进入 main 的每个提交都是完整可运行的状态。
