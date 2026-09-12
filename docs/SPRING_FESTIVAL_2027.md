# 乡声万语 · 2027 春节冲刺

> 本文是春节阶段的 Sprint charter 与一级路网，不替代[乡声集盒长期产品路线](PRODUCT_ROADMAP.md)，也不把所有 Epic 预拆为 Leaf。

## 1. Sprint 目标

2027 春节同时验证四件事：

- **产品**：用户愿不愿意使用、分享并回来；
- **数据**：是否产生真正有训练或资料价值的地方语言数据；
- **技术**：ASR / TTS 是否可证明改善并产生 Wow Moment；
- **商业**：B/G 客户真正愿意购买什么，以及不购买的原因。

这不是 migration sprint，也不是 contributor governance sprint。迁移和治理只为真实产品、数据、技术与商业验证服务。

春节阶段的 Project 是 [乡声万语 · 2027 春节冲刺](https://github.com/orgs/e-dialect/projects/7)。乡声集盒长期 Roadmap 继续由 #423 维护；春节 X/W 分别使用独立 Sprint Tracking。

## 2. 产品与实体边界

- E-Dialect 是开放 GitHub 工程社区；乡声万语是社区内的长期计划，不等同于整个社区。
- 北京塔聚科技有限责任公司可承接部分商业合同、交付和付款，但不等同于 E-Dialect 或乡声万语。权利边界以 `LICENSE`、CLA、合同及知识产权文件为准。
- **乡声集盒（X）**是本地语言工具、互动与可信众包产品，本身应值得用户使用；不是被“游戏化”的标注后台。
- **兴化语记**保留为莆仙语旗舰 Distribution Profile / Language Space，不建设第三套后端。
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

人员池还包括 @duskeditor、@Lulu-999-deer、@BUPTCXX、@xiaodiwend、@ohhgali。@xiang-fy 不参加本轮 X 组冲刺，不自动分配。赖济涛对应 @3964419257-cyber；夏鸿斌对应 @xiaodiwend，二者不得混用。

Sprint Tracking 的 Assignee 表示 accountable owner，不表示一人实现全部 Epic。@aB0T-bupt / @L8848-Li 负责各自的 Epic → Leaf；Codex 和 @lin594 均不预先永久分完全部 Leaf。

## 4. 执行节奏与能力分级

每周由 @aB0T-bupt、@L8848-Li 分别异步更新 `Done / Demo / Blocked / Next / Need Steering Decision`。约每两周进行 Demo Gate，必须展示真实页面、真机旅程、数据、模型输出或可复现实验，不能只展示 PPT。

成员能力按 L0 Executor、L1 AI-native Developer、L2 Work Package Owner、L3 负责人支持。目标是让每个人逐步达到至少 L1；能力不足时缩小 Leaf，不降低 Acceptance Gate。每个适合学生执行的 Epic / Work Package 都应定义用户或验收者可以直接看到的 **Demo Moment**。

## 5. X：乡声集盒一级 Epic

X Sprint Tracking：`SF-X · 2027 春节乡声集盒 Sprint Tracking`，Accountable Owner 为 @aB0T-bupt。

### SF-X-E1 · Campaign Feed & ContributionTask Engine

首页采用 Campaign-driven Feed，而不是 Feature Grid。Campaign 可包括“AI 听得懂莆田话吗”“教 AI 学一句乡音”“这句话你们家怎么说”“一句乡音拜大年”和莆田元宵专题。

底层 `Campaign + ContributionTask` 必须跨 Language Space 通用：Language Space 决定缺什么数据，Distribution Profile 决定如何告诉用户。

**Demo Moment**：创建 Campaign → 用户在首页看到 → 完成任务 → contribution 可追踪。

### SF-X-E2 · 莆仙知识库 / Search

目标旅程：普通话或莆仙表达搜索 → 正字 → 释义 → 拼音 → 专业层 IPA → 地区差异 → 真人录音 → 可用时的 AI Voice → feedback。普通用户优先看到正字、拼音、意思和真人声音，不要求理解 IPA。

**Demo Moment**：用户搜索一个春节表达，在同一旅程中听真人声音、查看含义并提交有上下文的反馈。

### SF-X-E3 · Speech Contribution / Speaker / Elder Proxy

覆盖 read speech、natural paired speech、raw natural speech，并显式记录 Speaker、Operator、linguistic background 和 contribution origin。必须支持年轻人操作、家中长辈讲话；Operator 不等于 Speaker。

**Demo Moment**：子女打开任务 → 长辈说一句 → 系统正确保存 speaker/operator 区别与授权来源。

### SF-X-E4 · Identity / Visitor / Consent

覆盖 Visitor ID、Visitor → User、微信主登录、Hinghwa identity migration、Speaker identity 和 consent。用途至少区分 public display、model training、internal research、commercial / derived capability。长期采用可修改的 persistent preference，不在每次录音重复弹出授权。

法律文本和身份合并均为 R2；隐私、同意或授权边界变化必须升级。

**Demo Moment**：游客完成一次有效贡献，之后使用微信登录，贡献和授权选择在不猜测身份的前提下正确承接。

### SF-X-E5 · 兴化语记 Distribution

#424 是本 Epic 的核心 tracking。覆盖品牌连续性、Puxian Language Space、Distribution Profile、账号迁移、旧 URL / deep link、旧内容与旧数据。只做 Legacy → X 单向迁移，不建设第三套后端或双向同步。

**Demo Moment**：从一个高频旧链接进入保留“兴化语记”心智的新莆仙页面，并可继续查、听或贡献。

### SF-X-E6 · ASR / TTS Wow Moment

春节把 ASR/TTS 作为 P0/P1 产品能力，而非长期 P4 研究清单。

```text
Wow A：用户说莆仙话 → ASR → 莆仙正字 → 普通话含义
Wow B：用户输入一句话 → 莆仙表达 → 莆仙正字 → TTS → AI 说莆仙话
```

本轮只收敛 ASR/TTS adapter、model version、confidence、Teach/Showcase mode、intermediate orthography 与产品接入，不扩成“研究所有模型”。效果不足时进入 Teach AI，足够可靠时才进入 Showcase。

**Demo Moment**：打开小程序 → 说一句莆仙话 → 看到正字和含义；或输入一句话并听到带版本与来源说明的莆仙 AI Voice。

### SF-X-E7 · WeChat Release

微信小程序是春节 Primary Target；H5 只用于辅助开发与 debug。覆盖真机、麦克风权限、录音/上传、分享、登录、elder mode、Parent Test、Feature Freeze、分阶段放量和 on-call。

**Demo Moment**：一位未参加开发的中老年莆仙用户无需开发者讲解即可在真机完成查、听、录音或代理录音并分享。

### SF-X-E8 · Analytics / Data / B-G Dashboard

至少追踪 Campaign、Task、Visitor、User、Speaker、Operator、Recording、Correction、Candidate、Validation、Language Space、linguistic background、model version、AI confidence、AI feedback、trusted ratio 与 funnel。

Dashboard 同时服务 Steering、产品复盘、B/G Demo 与 investor evidence。

**Demo Moment**：用真实试点数据展示从 Campaign 曝光到有效 Candidate/Trusted 数据的漏斗，并能按 Language Space、speaker background 与模型版本解释差异。

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

以上 W Epic 的共同 Demo Moment 是：真实材料可被导入、独立校对/仲裁并产生可审计结果；各 Epic 的 Leaf 由 @L8848-Li 定义具体样本、规模与 Gate。

## 7. Review Contract v0

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

- @lin594 的江口腔 20–30 分钟仅作 dev corpus，跑通工程 pipeline，不作春节正式 Anchor。
- 正式 pilot 优先莆田城里腔 reference speaker：先录 30–60 分钟 continuous speech；验证有效后再扩到 3–5 小时。
- 单字/语素录音定位为 Citation Pronunciation，用于字典真人发音、IPA/拼音验证、diagnostic 和教学，不替代连续句 TTS corpus。

### 历史媒体

处理链为 raw archive → VAD → 必要时 diarization/denoise → candidate segments → human review。Raw 永不覆盖，derived 独立保存，machine pre-cut 后必须人工检查。历史视频不得直接作为 Gold TTS；原媒体使用授权不自动包含 voice synthesis，后者必须单独授权。

## 9. Active Learning 与质量状态

Active Learning 复用通用 ContributionTask Engine，首版仅使用规则：ASR low confidence、frequent correction、phonological/speaker/dialect coverage gap、trusted contributor disagreement。不做论文级 acquisition algorithm。

数据状态统一为 `Raw → Candidate → Validated → Trusted / Gold`。用户对 AI 的纠正默认进入 Candidate，不能直接进入下一轮训练。

## 10. 外部准备、发布与运营

`SF-STEERING · External Resources & Acceptance` 由 @lin594 负责外部资源与 Gate，包括城里腔 reference speaker、江口腔 dev corpus、历史媒体与 TTS 合成授权、IPA/phonology expert、B/G Discovery Kit、图书馆/学校联系准备、investor evidence、Release Gate 及 Steering Decision/Directive。

B/G Discovery Kit 至少包含一页介绍、3 分钟线上 Demo、能力图、合作菜单、访谈问题和可分享链接；优先微信/在线/warm introduction，GitHub 不保存不必要的个人信息。

现有种子渠道约 1200 名高相关用户：莆仙乡音社 QQ 约 500、微信群约 200、枫登书店 community 约 500。按 `30 → 200 → 1000 → public` 放量，每一级检查 journey completion、recording success、share rate、AI feedback、elder proxy completion 和 valid data ratio。

Campaign 覆盖春节前预热、除夕/正月初、元宵、莆田特色长元宵和农历二月长尾，不只押注正月初一。

公开放量前必须通过 Parent Test：@lin594 自己愿意发给父母，且 2–3 位未参与开发的中老年莆仙用户无需讲解可完成查、听、录音或代理录音，否则 Release Gate fail。

放量前进入 Feature Freeze。允许 bug、performance、真机、内容、Campaign、数据修复和不改变 contract 的模型替换；禁止大 schema migration、大 UI 重写、新社交系统或突发大功能。

考试期从 Build 转向 Data / Test / Content，优先 speaker recruitment、Gold recording、corpus cleaning、baseline、Campaign content、true-device QA 与 user testing。

春节核心传播期由 @aB0T-bupt 负责乡声集盒值班安排、@L8848-Li 负责万语校坊值班安排。@lin594 不进入普通 on-call，只接收重大数据丢失、法律/隐私、严重公开事件与 stop-service decision。

## 11. 明确不做

- 合并三个治理 PR；
- 真正训练 ASR/TTS 或扩大为全模型研究；
- 大规模产品实现或一次性拆完所有 Leaf；
- X/W 后端、数据库、用户表合并；
- realtime Review API、webhook、message queue、full OIDC；
- 因仓库改名而重命名内部全部 package/module。
