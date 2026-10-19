# 整理溯源基础迁移

## 2026-10-19 历史权限修复：词汇同行读取竞争解释

- 词汇整理员可创建 `preserve_competing`，动作实际以 Recording 为 target。历史查询现明确允许有效词汇整理员读取这类动作，但要求目标录音及快照 `competing_link.entry_id` 对应词条当前均可见；没有开放普通录音 review/narrow_scope。
- 将已有 JSON entry_id 文本提取及可见 ID 子查询共享给词汇/地区分支，保留 PostgreSQL 类型兼容。地区分支的当前及历史范围限制不变；actor 本人历史及同行字段/证据裁剪规则不变。
- 新增六项测试，覆盖真实创建后同行详情/列表、脱敏、录音隐藏/删除、词条可见集合/删除、缺失及损坏快照、撤权与无授权用户、其他录音动作隔离。词汇整理员原本可见私有词条，测试不把 visibility=false 当作词汇角色不可见。
- 实际运行 scope/provenance/governance 定向测试共 46 项，45 通过、1 项 SQLite 行锁跳过；API contract 通过。独立 agent 只读复核未发现本轮阻塞或权限扩大。
- 本轮未新增迁移、未改前端、未部署、未实测 PostgreSQL 或在线账号旅程，未重复完整后端测试；最新远端 CI 以本轮 head 为准。

## 2026-10-19 二次审查修复：拆分产物也是决策参与者

- `split_entry` 的动作目标是原词条，新建词条只记录在 `after_snapshot.created`。范围保护现按 `action_type=split_entry`、`target_type=entry` 和 `after_snapshot.created.id` 精确匹配新词条；即使其全部内容仍是草稿、metadata 被清空，普通地区更新也不能绕过治理操作。
- 新增三项回归：真实拆分出的草稿拒绝普通 PATCH/PUT，允许同值/无关字段更新及有依据的治理缩小范围，原拆分快照保持不变；不相关拆分产物或其他动作的同形快照不会误伤普通草稿。
- 核对其他多对象动作：合并的 canonical/sources 分别为 reviewed/redirected，由状态保护；竞争解释的范围归属 Recording，直接动作及已审核关联均保护，不把仅关联的 Entry 当作继承该录音地区。
- 实际验证：`python manage.py test guantou.tests_v2_scope guantou.tests_v2_provenance guantou.tests_v2_governance --noinput` 共 40 项，39 通过、1 项 SQLite 行锁跳过；API contract 检查通过。独立 agent 复核本轮差异未发现阻塞。
- 本轮未新增迁移、未部署、未重复完整后端/真实并发或在线验收；上轮本机 config 失败已在修改前基线复现，不能声称本地完整测试全通过。以最新提交的远端 CI 为准。

## 2026-10-19 审查修复：子对象决定保护父范围

- 普通地区更新除目标自身状态/历史外，还检查 Entry 的义项和写法关联、Recording 的录音关联的整理状态与动作历史；查询包含非当前关联版本。
- 保留纯草稿、同值保存及无关字段编辑。录制者初始著录/补充关联的服务端 accepted 标记不冒充整理审核：仅创建者为录制者、无审核标记、无前继版本且标记完全匹配时例外；任何动作历史仍触发保护。不明旧 accepted 关联保守保护。
- 子对象审核和义项概念关联先锁父对象，再锁子对象并复核归属，与普通地区更新共用父锁；没有新增数据库迁移。
- 定向命令：`python manage.py test guantou.tests_v2_scope guantou.tests_v2_provenance guantou.tests_v2_governance --noinput`：37 项，36 通过、1 跳过（SQLite 无行锁）。Black、API contract、`makemigrations --check --dry-run` 和 `git diff --check` 通过。
- 独立 agent 复核了子对象范围、历史版本、锁顺序与著录例外，未发现本轮新增阻塞。初轮测试断言未适配统一错误响应，且将不支持的 Recording PUT 误期待为 400；已修正测试，未放宽产品校验。
- 未验证：真实 PostgreSQL 双连接行锁测试（已提供 NOWAIT 用例；本机 Docker 未运行，SQLite 明确跳过）、在线账号旅程及生产环境；这次修复不声称完整并发安全或维护者人工验收。
- 另行发现的既有风险：普通 EntrySense 接口允许修改 `entry_id`，其权限和重新挂父对象的治理边界应单独修复；本次只处理父地区修改与子对象治理审核，不把该问题标为已解决。

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
