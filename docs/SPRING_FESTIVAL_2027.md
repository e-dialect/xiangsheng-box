# 乡声万语 · 2027 春节冲刺

> 本文是春节阶段的 Sprint charter 与一级路网，不替代[乡声集盒长期产品路线](PRODUCT_ROADMAP.md)，也不把所有 Epic 预拆为 Leaf。

## 1. Sprint 目标

2027 春节同时验证四件事：

- **产品**：用户愿不愿意使用、分享并回来；
- **数据**：是否产生真正有训练或资料价值的地方语言数据；
- **技术**：ASR / TTS 是否可证明改善并产生 Wow Moment；
- **商业**：B/G 客户真正愿意购买什么，以及不购买的原因。

这不是 migration sprint，也不是 contributor governance sprint。迁移和治理只为真实产品、数据、技术与商业验证服务。

春节阶段的 [Project #7 · 乡声万语 · 2027 春节冲刺](https://github.com/orgs/e-dialect/projects/7) 是 Sprint execution cockpit，只收录直接服务本轮 Gate、Demo 或 Journey 的执行项。乡声集盒长期 Roadmap 与技术债继续保留在仓库及 #423，不需要进入 Project #7；春节 X/W 分别使用独立 Sprint Tracking。

## 2. 产品与实体边界

- E-Dialect 是开放 GitHub 工程社区；乡声万语是社区内的长期计划，不等同于整个社区。
- 目前乡声万语相关商业合作、签约与交付由北京塔聚科技有限责任公司作为商业/法律承载主体；具体权利义务以实际合同、许可证、CLA 和知识产权文件为准。E-Dialect GitHub Organization 不等同于北京塔聚科技有限责任公司，也不等同于乡声万语。
- **乡声集盒（X）**是地方语言工具、互动与可信众包产品，本身应值得用户使用；不是被“游戏化”的标注后台。
- **Anchor Language Space = 莆仙方言；Flagship Distribution Profile = 兴化语记。** Language Space 定义缺什么数据，Distribution Profile 定义如何面向用户呈现；二者不合并为同一个模型，也不建设第三套后端。
- **万语校坊（W）**是面向方言、地方语言与民族语言资料的独立智能协同校勘产品，具有独立部署、使用和商业价值；在乡声万语内部也承担 Candidate → Trusted / Gold 的专业工作台职责。它不是 X 的管理后台。
- X/W 保持独立部署、数据库、认证与权限模型。稳定的 X identity 只通过显式 external identity mapping 对应 W local user，不共享用户表。

## 3. 负责人、沟通与长期 Work Package

- Steering / Acceptance / Gatekeeper：[@lin594](https://github.com/lin594)
- [@aB0T-bupt](https://github.com/aB0T-bupt)：乡声集盒 Sprint Tracking 与 Epic 拆解
- [@L8848-Li](https://github.com/L8848-Li)：万语校坊 Sprint Tracking 与 Epic 拆解
- X 指导教师：杨树杰；W 指导教师：杨树杰、周赞双。

默认沟通链是 `Member → @aB0T-bupt / @L8848-Li → @lin594`。Shared 只是 Project workstream，不是第三个直属团队；@lin594 日常只与 @aB0T-bupt、@L8848-Li 对接。

长期分工编号已有人员主责语义，春节 Epic **不得复用**：

| 长期编号 | 方向 | 当前确认 |
|---|---|---|
| X1 | 采集体验与任务设计 | 由 @aB0T-bupt 后续细分 |
| X2 | 语音智能与质量控制 | 由 @aB0T-bupt 后续细分 |
| X3 | 语料模型与可信证据 | @Ccc-192 |
| X4 | 地方站与资料接入 | 由 @aB0T-bupt 后续细分 |
| X5 | 社群采集与效果评测 | 由 @aB0T-bupt 后续细分 |
| W1 | 文献资产与语料工程 | 由 @L8848-Li 后续细分 |
| W2 | 文档解析与结构化 | 由 @L8848-Li 后续细分 |
| W3 | 智能校勘与错误发现 | @QIANBAI634 |
| W4 | 协同校勘与志愿者运营 | @3964419257-cyber |
| W5 | 数据融合与发布衔接 | 由 @L8848-Li 后续细分 |

Sprint Tracking 的 Assignee 表示 accountable owner，不表示一人实现全部 Epic。@aB0T-bupt / @L8848-Li 负责各自的 Epic → Leaf；Codex 和 @lin594 均不预先永久分完全部 Leaf。

具体任务主责以 GitHub native Assignee 与 Project #7 为执行真源；本文不维护完整人员 roster，避免与 GitHub 状态重复和漂移。

## 4. 执行节奏与能力分级

每周由 @aB0T-bupt、@L8848-Li 分别异步更新 `Done / Demo / Blocked / Next / Need Steering Decision`。约每两周进行 Demo Gate，必须展示真实页面、真机旅程、数据、模型输出或可复现实验，不能只展示 PPT。

成员能力按 L0 Executor、L1 AI-native Developer、L2 Work Package Owner、L3 负责人支持。目标是让每个人逐步达到至少 L1；能力不足时缩小 Leaf，不降低 Acceptance Gate。每个适合学生执行的 Epic / Work Package 都应定义用户或验收者可以直接看到的 **Demo Moment**。

## 5. X：乡声集盒一级 Epic

X Sprint Tracking：`SF-X · 2027 春节乡声集盒 Sprint Tracking`，Accountable Owner 为 @aB0T-bupt。

### SF-X-E1 · Campaign Feed & ContributionTask Engine

首页采用 Campaign-driven Feed，而不是 Feature Grid。Campaign 可包括“AI 听得懂莆田话吗”“教 AI 学一句乡音”“这句话你们家怎么说”“一句乡音拜大年”和莆田元宵专题。

底层 `Campaign + ContributionTask` 必须跨 Language Space 通用：Language Space 决定缺什么数据，Distribution Profile 决定如何告诉用户。

**Demo Moment**：创建 Campaign → 用户在首页看到 → 完成任务 → contribution 可追踪。

### SF-X-E2 · 莆仙知识库 / Search / 问一句

Search 与“问一句”访问同一套结构化知识库。“问一句”不是第三个 AI 平台，也不新建 RAG 基础设施：自然语言先经过 intent/query parser，再确定性检索 `Entry`、`EntrySense`、`WritingForm`、`PronunciationVariant`、`Recording`、`EvidenceRecord`、`UsageAttestation`、`Dialect`，最后组合可回溯的回答。资料不足时明确说明“目前资料还不足以可靠回答这个问题”，并可进入“你知道怎么说吗？”ContributionTask。

Spring v0 必须与现有乡声集盒 Web 服务共存于当前 4GB 主机，不新增固定 GPU/LLM 主机，不以独立 Vector DB 或本地生成式 LLM 为运行前提。优先使用规则意图解析和现有数据库、全文检索、alias、synonym、Concept；外部小模型如被采用，只能辅助 query parsing、intent classification 或 wording，必须有额度/成本上限，并在不可用、超时或额度耗尽时无损退化为确定性检索。方言事实始终来自知识库。

`e-dialect/hinghwa-RAG` 上游未明确开源许可证；在权利明确前不得复制或复用其代码、Prompt 或数据资产，只能独立实现通用思想。

**Demo Moment**：用户搜索一个春节表达，或问“害怕莆田话怎么说？”，在同一旅程看到有证据的正字和含义、听到真人声音，并在资料不足时获得诚实降级与可追踪贡献入口。

### SF-X-E3 · Speech Contribution / Speaker / Elder Proxy

覆盖 read speech、natural paired speech、raw natural speech，并显式记录 Speaker、Operator、linguistic background 和 contribution origin。必须支持年轻人操作、家中长辈讲话；Operator 不等于 Speaker。

**Demo Moment**：子女打开任务 → 长辈说一句 → 系统正确保存 speaker/operator 区别与授权来源。

### SF-X-E4 · Identity / Visitor / Consent

覆盖 Visitor ID、Visitor → User、微信主登录、Hinghwa identity migration、Speaker identity 和 consent。用途至少区分 public display、model training、internal research、commercial / derived capability。长期采用可修改的 persistent preference，不在每次录音重复弹出授权。

法律文本和身份合并均为 R2；隐私、同意或授权边界变化必须升级。

**Demo Moment**：游客完成一次有效贡献，之后使用微信登录，贡献和授权选择在不猜测身份的前提下正确承接。

### SF-X-E5 · 兴化语记 Distribution

#424 是本 Epic 的核心 tracking。Spring P0 覆盖品牌连续性、旧 URL/deep link、旧 ID/内容映射、Puxian Language Space、Distribution Profile、migration rehearsal、生产副本数据质量检查和 rollback plan。只做 Legacy → X 单向迁移，不建设第三套后端或双向同步。

真实账号或真实生产数据的 destructive cutover 是 Conditional：只有 rehearsal、数据质量、rollback、@aB0T-bupt R2 验收和必要 Steering Decision 全部通过后才执行。生产 cutover 本身不作为春节 Sprint 成功的硬性必要条件。

**Demo Moment**：从一个高频旧链接进入保留“兴化语记”心智的新莆仙页面，并可继续查、听或贡献；未 cutover 时，以生产副本 rehearsal 演示同一旅程与回滚。

### SF-X-E6 · ASR / TTS Wow Moment

春节把 ASR/TTS 作为 P0/P1 产品能力，而非长期 P4 研究清单。

```text
Wow A：用户说莆仙话 → ASR → 莆仙正字 → 普通话含义
Wow B：用户输入一句话 → 莆仙表达 → 莆仙正字 → TTS → AI 说莆仙话
```

Prototype Gate 只要求 Wow A / Wow B 至少一条形成可复现实验；Pre-SF / Release Gate 要求两条都形成用户可理解、可复现的真机产品旅程，不能用单 Wow 冒充最终双 Wow。效果不足时进入 Teach AI，足够可靠时才进入 Showcase。

本 Epic 不在规划阶段预先穷举全部模型训练 Leaf。Gold、baseline、adapter contract 和预算明确后，由 @aB0T-bupt 按必要性拆解有限模型实验；禁止无限扩展模型搜索、训练次数和工程范围。

**Demo Moment**：打开小程序 → 说一句莆仙话 → 看到正字和含义；并且输入一句话 → 莆仙表达/正字 → 听到带版本与来源说明的莆仙 AI Voice。

### SF-X-E7 · WeChat Release

微信小程序是春节 Primary Target；H5 只用于辅助开发与 debug。覆盖真机、麦克风权限、录音/上传、分享、登录、elder mode、Parent Test、Feature Freeze、分阶段放量和 on-call。

**Demo Moment**：一位未参加开发的中老年莆仙用户无需开发者讲解即可在真机完成查、听、录音或代理录音并分享。

### SF-X-E8 · Minimum Evidence Layer / Analytics

本轮不是建设 BI 平台。只建立指标字典、Event Contract、Campaign funnel、Recording/Candidate/Trusted 质量状态、model version/confidence、rollout go/no-go 与去标识化的最小 Dashboard 或 report。

不引入大型数仓、实时 OLAP、X/W 共享数据库，也不为 Dashboard 新购长期服务器。X/W 只通过显式 bundle 或去标识化结果聚合交换证据。

**Demo Moment**：用真实试点数据和最小 dashboard/report 展示从 Campaign 曝光到有效 Candidate/Trusted 数据的漏斗，并能按 Language Space、speaker background 与模型版本解释足以支持 rollout go/no-go 的差异。

## 6. W：万语校坊一级 Epic

W Sprint Tracking：`SF-W · 2027 春节万语校坊 Sprint Tracking`，Accountable Owner 为 @L8848-Li。原则是 **Data First + Product Polish**，春节前不重写核心架构。

### SF-W-E1 · Asset Inventory & Rights

盘点莆仙资料、PDF、CSV、正字、词典、pronunciation、历史录音、外部授权与蒙古语资料。权利至少区分 public display、internal research、model training、commercial use、redistribution、raw third-party transfer。

### SF-W-E2 · 莆仙真实资料整理试点

直接使用词典、PDF、正字和 legacy materials，不用 mock data；边真实校勘，边发现产品和数据 contract 问题。

### SF-W-E3 · 蒙古语 20k+ 数据试点

蒙古语是民族语言，不描述为“汉语方言”。Primary work-package contact 为 @QIANBAI634，发挥其蒙古语、Python、ETL 与低资源语言能力，但不要求一人承担全部工程。

### SF-W-E4 · Product Polish & Volunteer Workflow

让万语校坊现在就能给真实校对者使用，覆盖 bug、mobile、import、proofreading UX、arbitration、volunteer onboarding 与 project workflow。W4 主责为 @3964419257-cyber。

### SF-W-E5 · Review Bundle v0

定义并跑通 source system、source id/version、payload、requested fields、result 与 provenance。不做 realtime API、webhook、distributed transaction 或 shared DB。

### SF-W-E6 · Gold / Trusted Corpus / Phonology

覆盖 Gold Test、expert annotation、IPA、trusted corpus、corpus QA 和 phonology diagnostic。Project 中 `Team=Shared`，owner-of-record 为 @L8848-Li。

以上 W Epic 的共同 Demo Moment 是：真实材料可被导入、独立校对/仲裁并产生批量最终结果；当前导出不被夸大为包含逐位校对全过程的完整审计包。各 Epic 的 Leaf 由 @L8848-Li 定义具体样本、规模与 Gate。

## 7. Review Bundle v0

第一版只打通语义与人工可控批次：

```text
X export Review Bundle
→ human check
→ W import
→ independent proofreading
→ arbitration if needed
→ W export Review Result
→ human check
→ X import
```

原则是“**先打通语义，再打通网络**”。春节不做 webhook、distributed sync、message queue、shared database、复杂 service account 或 full OIDC。

@aB0T-bupt 的 owner-of-record 范围：ASR/TTS inference、adapter、model serving、Active Learning engine 与产品集成。@L8848-Li 的 owner-of-record 范围：Gold Test、corpus QA、IPA、expert annotation、trusted corpus 与 Review Bundle。

## 8. Gold、发音与 TTS 基线

### Puxian ASR Gold v0

- Anchor 为莆田城里腔；其他地区继续采集并保留标签。
- 初始约 `8 speakers × 30 utterances ≈ 240`，只用于 evaluation，绝不进入 training。
- 大多数样本包含 audio、correct orthography、speaker metadata、linguistic background。
- 只为约 30–40 个高价值连读变调样本制作专业 IPA diagnostic。

### 莆仙发音表示

每字本调与整词 surface IPA 分开记录。多字 surface 以 IPA 为准确记录；莆仙拼音是普通用户的近似 renderer，不把两套表示当作相互竞争的 source of truth，也不在本轮建设复杂 sandhi rule engine。

### TTS 数据路线

- 小规模非 Anchor 材料仅作 dev corpus，用于跑通工程 pipeline，不作春节正式评估基线。
- 正式 pilot 优先莆田城里腔 reference speaker：先录 30–60 分钟 continuous speech；验证有效后再扩到 3–5 小时。
- 单字/语素录音定位为 Citation Pronunciation，用于字典真人发音、IPA/拼音验证、diagnostic 和教学，不替代连续句 TTS corpus。

### 历史媒体

处理链为 raw archive → VAD → 必要时 diarization/denoise → candidate segments → human review。Raw 永不覆盖，derived 独立保存，machine pre-cut 后必须人工检查。历史视频不得直接作为 Gold TTS；原媒体使用授权不自动包含 voice synthesis，后者必须单独授权。

## 9. Active Learning 与质量状态

Active Learning 复用通用 ContributionTask Engine，首版仅使用规则：ASR low confidence、frequent correction、phonological/speaker/dialect coverage gap、trusted contributor disagreement。不做论文级 acquisition algorithm。

数据状态统一为 `Raw → Candidate → Validated → Trusted / Gold`。用户对 AI 的纠正默认进入 Candidate，不能直接进入下一轮训练。

## 10. 外部准备、发布与运营

`SF-STEERING · External Resources & Acceptance` 负责外部资源与 Gate。资源类别包括：

- Anchor reference speaker；
- dev corpus；
- historical-media authorization；
- voice-synthesis authorization；
- phonology / IPA expert；
- B/G Discovery Kit。

具体人员、材料、授权和准备状态统一记录在 `.github #2` 与 Project #7，不在 Charter 维护易漂移的个人资源表。

B/G Discovery Kit 至少包含一页介绍、3 分钟线上 Demo、能力图、合作菜单、访谈问题和可分享链接；优先微信或在线沟通，GitHub 不保存不必要的个人信息。

按 `30 → 200 → 1000 → public` 分阶段放量，每一级检查 journey completion、recording success、share rate、AI feedback、elder proxy completion 和 valid data ratio：

- **2027-01-15 前**：reference speaker / Gold / TTS pilot 资源进入可用状态，核心 P0 contract 基本冻结；
- **2027-01-16 ～ 2027-01-23**：30 人 internal / close-friend test、Parent Test、微信真机核心旅程；
- **2027-01-24**：Feature Freeze target；
- **2027-01-25 ～ 2027-01-29**：约 200 人 seed test；
- **2027-01-30 ～ 2027-02-05**：约 1000 人 preheat，Campaign 内容就位，只允许 Freeze 白名单改动；
- **2027-02-06 起**：Spring public campaign；
- **2027-02-20**：元宵第二波；
- **2027-02 下旬 ～ 03 月**：莆田长元宵 / 农历二月长尾、数据复盘、B/G Discovery 与模型二轮。

若学校考试或放假冲突，由 @aB0T-bupt / @L8848-Li 提 Decision 给 @lin594 调整；不要为守日期牺牲 Parent Test。

Campaign 覆盖春节前预热、除夕/正月初、元宵、莆田特色长元宵和农历二月长尾，不只押注正月初一。

公开放量前必须通过 Parent Test：验收者愿意把产品发给家人，且 2–3 位未参与开发的中老年莆仙用户无需讲解可完成查、听、录音或代理录音，否则 Release Gate fail。

放量前进入 Feature Freeze。允许 bug、performance、真机、内容、Campaign、数据修复和不改变 contract 的模型替换；禁止大 schema migration、大 UI 重写、新社交系统或突发大功能。

考试期从 Build 转向 Data / Test / Content，优先 speaker recruitment、Gold recording、corpus cleaning、baseline、Campaign content、true-device QA 与 user testing。

春节核心传播期由两个 accountable owner 分别安排各产品值班；重大数据丢失、法律/隐私、严重公开事件与 stop-service decision 按治理路径升级。

## 11. 明确不做 / Scope Guardrails

- 不把春节 Sprint 扩成无边界的全模型研究或论文级模型搜索；
- 不为了追求模型指标无限扩大训练、实验或工程范围；
- 不把 AI 输出当作语言事实自动裁判；
- 不合并 X/W 后端、数据库、用户表或权限模型；
- 不在春节阶段建设 realtime Review API、webhook、message queue、distributed transaction 或 full OIDC；
- 不建立第三套“兴化语记”后端；
- 不在 Feature Freeze 后进行大型 schema migration、大 UI 重构、新社交系统或突发大功能；
- 不一次性实现长期 Roadmap 中所有 Community / Theme / Collection / Infrastructure 能力；
- 不因仓库 rename 而重命名内部稳定 package、module 或 migration。
