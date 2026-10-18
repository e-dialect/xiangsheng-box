# 整理溯源基础迁移

日期：2026-10-18。将测试站点已使用的后端修复移植到主项目，供来源展示、范围修正与历史回溯 UI 使用。本次不部署、不操作在线数据库。

## 分支与依赖

- 基线：`upstream/main` 的 `3e27446cfbe9566733ab437169b414607a3d86ac`（2026-10-18 fetch 后未变化）。
- 分支：`codex/migrate-curation-backend`，原提交 `0d18ef03eb5da6d714184dc8bba579ec11629aaa`，移植提交 `bd8ab6c`。
- UI 分支 `codex/migrate-stage2-ui` 基于本分支；后端先合并，UI 再调整目标分支至 main。发布前检查最新主线是否新增同编号 migration 或等价实现。

## 行为与审查重点

- 普通地区字段更新不得绕过整理语义动作与证据要求。
- 同行历史读取受目标当前可见性和历史前后地区范围共同约束；范围外、仅子地区授权不能读取上级范围历史。
- 撤权阻止新动作，操作者本人旧历史仍可读。历史授权取操作时服务端快照，不由当前 grant 重构。
- 0027 为新增 JSON 快照列；旧记录为空不代表当时无授权，界面应显示未保存。API contract 与迁移一同进入本分支。

## 已有验收与发布边界

测试站点前端 `59ae474` / 后端 `0d18ef0` 的 AC1–AC8 已由项目负责人确认完成，覆盖普通 A/B、范围外 C/子地区 D、撤权 A、错误恢复与原业务回归。依据为负责人报告，逐项时间、对象引用和截图待受控归档；不声称本次重新在线复测。

论文工作区的受控记录为 `CSCWD/evidence/collaboration-walkthrough/stage-2-acceptance-2026-10-17.md`（相对产品主工作区，不随产品发布）。后续维护者允许继续受控会话及限定材料使用，不据此推定特定代码/contract 已逐项人工审查。

本分支涉及权限和迁移，按 [R2 要求](AI_NATIVE_CONTRIBUTION.md)记录关键 contract/失败路径人工审查、维护者验收以及备份/恢复证据。普通功能验收不自动证明并发撤权或 SQLite 锁冲突专项行为。

新部署环境先备份、应用 0027，再发布后端与配套 UI。保留旧镜像；反向迁移会丢弃快照列，恢复原快照需要数据库备份，不能仅靠代码 revert。现有测试站点已应用 0027，不重复执行数据库变更。

## 本次验证（2026-10-18）

- `manage.py check` 与 `makemigrations --check --dry-run` 通过，API contract 检查通过。
- `manage.py test announcements audit files guantou inbox productanalytics siteconfig themes user --verbosity 1`：**241 项通过**，包含权限/溯源和 0027 迁移升级、旧写入兼容、回退与备份恢复测试。
- 后端格式检查：209 文件通过；独立 agent 检查依赖、迁移和权限边界，未发现新增问题。
- 初次沙箱运行因 Windows 临时目录权限出现 9 failures / 24 errors；获准在完整权限环境复跑同一命令后全通过，没有为测试修改产品代码。
- 本次使用已有 Python 3.14 虚拟环境；未在本轮重跑 `config` 测试、完整 Linux CI 或生产数据库恢复；未实测并发撤权、SQLite 锁冲突或重新执行在线账号旅程。测试中的模拟锁失败日志属于已通过的失败路径测试，不作为真实并发证据。
- 原后端与迁移分支的 `backend/guantou`、`docs/api` 内容一致。完整业务测试日志保存在产品主工作区 `output/migration-backend-tests.log`，不随产品发布。
