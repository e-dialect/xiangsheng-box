# Work Package Guide

GitHub 是正式任务真源：

> 没有 Issue = 没有正式任务。

2026 年治理初始化 PR #422 在本规则落地前创建，是一次性 bootstrap 例外；该例外不
适用于后续产品实现、迁移或数据任务，也不得作为跳过 Leaf Issue 的先例。
>
> 没有 Assignee = 没有人正式认领。

## 1. Issue 类型

- **Tracking / Epic**：汇总范围、依赖和决策，不作为一个整体实现任务。
- **Leaf Work Package**：唯一可认领的实现/调研/QA/数据任务。

## Ownership

GitHub 原生 Assignee 是 ownership 真源，但不同层级含义不同：

- **Tracking / Epic Assignee：Accountable Owner**
  - 负责 scope、拆分、优先级、风险、证据与 Gate；
  - 不表示该人亲自实现全部子任务。
- **Leaf Assignee：Implementation Owner**
  - 表示当前实际推进实现、调研、QA 或数据工作的负责人。

因此：

- Epic 可以有 Assignee；
- “Tracking / Epic 不直接认领实现”指的是不能把整个 Epic 当一个实现任务做完；
- Leaf 才是普通 contributor 实际认领的执行单元。

## 2. Size

| Size | 含义 |
|---|---|
| XS | 低判断、低风险、局部、验证简单 |
| S | 一个清晰独立成果，默认工作包 |
| M | 跨层 / contract / migration / 多端 / 高验证成本 |
| L | 不允许直接认领，必须继续拆 |

默认每人最多 `1 Primary + 1 Secondary`，同时最多 2 个开放实现 PR。

## 3. 标准模板

```markdown
## 用户/系统问题
一句话说明为什么要做。

## 完成后应该发生什么
从用户或系统行为描述结果。

## 范围
- ...

## 不在本 Issue 做
- ...

## 建议修改范围
- `path/...`

## 验收
- [ ] 行为/产物
- [ ] 自动验证
- [ ] 人工验证/数据核对
- [ ] 无新增 warning/error（若适用）

## 完成证据
PR / 截图 / 测试日志 / 数据报告 / 原型 / ADR。

## Demo Moment
验收者执行什么步骤，可以直接看到什么结果。

## 依赖
- blocked by #...
- parent #...

## Size
S

## Track
Dialect Experience / Dialect Commons
```

## 4. 认领规则

开始前：

1. 将 Issue assign 给自己；
2. 评论分支名、预计修改文件、首个可 review checkpoint；
3. 若已有 Assignee，不并行改同一组核心文件；
4. 7 天无提交、PR 或状态评论时可先询问再释放。

## 5. 当前状态与优先级

[Project #7](https://github.com/orgs/e-dialect/projects/7) 的 Status / Priority 是本轮当前状态和优先级的唯一真源；Issue 原生父子关系、依赖和 Assignee 分别记录归属、前置与认领。2027 春节承诺范围以里程碑 #10（2027-02-05）为准。长期总单 #423、UI 计划 #339 和旧能力矩阵 #584 不重复充当本轮执行清单。

- Status 使用 Backlog、Ready、Doing、Verify、Gate、Done、Parked、Blocked。规格不清放 Backlog；规格清楚但等待具体前置依赖放 Blocked；规格和依赖均已满足才放 Ready。
- Priority 的 P0 是上线阻塞，P1 是春节计划，P2 是非本轮必需。它们不同于 [产品路线](PRODUCT_ROADMAP.md) 的长期 P0–P4 层。
- 开放 Issue 不再用 `status:*`、`priority:*` 或 `ready for contributor` 标签表达当前状态；历史标签可以保留。类型、skill、size 标签仍可使用。
- 原生关闭为 completed 才进入 Done；not planned 是归档，不计完成。PR 合并不等于生产上线。

保留现有认领；新建且尚无人认领的春节工作包默认先 assign 给 @aB0T-bupt。每人默认最多一个主任务和一个辅任务。

## 6. 非代码贡献

UX audit、原型、真机 QA、数据质量报告、migration rehearsal、ADR、fixture、旧能力盘点、Issue 拆分都可以成为正式 Work Package，只要满足：

```text
明确问题 + 可复核产物 + 验证/依据 + 后续可复用
```

## 7. 能力分级

- L0 Executor
- L1 AI-native Developer
- L2 Work Package Owner
- L3 负责人

目标是让每位成员至少逐步进入 L1。能力不足时由 @aB0T-bupt 缩小 Leaf 的范围与判断面，不降低 Acceptance、Evidence 或 Demo Moment 标准；乡声集盒 Epic → Leaf 的拆解由 @aB0T-bupt 负责。
