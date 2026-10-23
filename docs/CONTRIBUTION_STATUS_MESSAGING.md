# 子任务 A：贡献状态审计与用户文案（#427）

本文件是 #427 子任务 A 的交付物；子任务 B 使用映射模块和测试把本表变成可重复验收的契约。
前端显示时应保留 API 的机器状态键，在展示边界统一调用 `contributionStatus(objectType, status)`。

## 范围和原则

- 只覆盖当前 V2 运行时的真实状态，不新增数据库状态机或接口字段。
- 状态属于具体对象：词条、录音、录音关联、证据关系和本地使用确认不能混成一个总状态。
- “已整理”“已公开”“已建立关联”描述流程或可见性，不表示语言事实已经被权威认证。
- 原始证据和贡献者原话是可追溯资料；整理结果不得覆盖它们。
- 没有用户侧操作入口时，文案应明确“查看详情/暂时无需处理”，不得承诺不存在的重提、申诉或编辑流程。
- 未知状态必须使用安全兜底 `状态待确认`，不能把未知值猜成通过、失败或认证。

## 状态映射

### 验收版用户阶段

底层状态仍保留在 API 中；下面四类是给普通用户看的稳定阶段，不是新的数据库状态：

| 用户阶段 | 含义 | 用户通常还能做什么 |
| --- | --- | --- |
| 处理中 | 已收到资料或关系，但整理结果尚未稳定 | 查看当前记录，等待后续整理 |
| 已采用 | 当前记录或关系已经进入可展示结构 | 查看详情、来源和保留的证据 |
| 待补充 | 已有记录，但仍存在缺项、分歧或待核对依据 | 补充文字、地区、来源或其他依据 |
| 暂不能处理 | 当前提交或关系没有进入现有结构 | 查看原因，使用仍然存在的入口重新提交 |

下表是本任务的可复核状态清单。`状态来源`只引用当前 V2 模型字段，不代表新增接口或状态机。

| 对象 | 内部状态 | 用户阶段 | 状态来源 |
| --- | --- | --- | --- |
| Entry | `draft` / `disputed` | 待补充 | `Entry.status` |
| Entry | `reviewed` / `redirected` | 已采用 | `Entry.status` |
| EntrySense | `draft` / `disputed` | 待补充 | `EntrySense.status` |
| EntrySense | `reviewed` | 已采用 | `EntrySense.status` |
| EntryWriting | `draft` / `disputed` | 待补充 | `EntryWriting.status` |
| EntryWriting | `reviewed` | 已采用 | `EntryWriting.status` |
| EntryWriting | `rejected` | 暂不能处理 | `EntryWriting.status` |
| PronunciationVariant | `draft` / `disputed` | 待补充 | `PronunciationVariant.status` |
| PronunciationVariant | `reviewed` | 已采用 | `PronunciationVariant.status` |
| PronunciationVariant | `rejected` | 暂不能处理 | `PronunciationVariant.status` |
| Recording | `draft` | 待补充 | `Recording.status` |
| Recording | `published` | 已采用 | `Recording.status`（仅表示公开可见） |
| Recording | `disputed` | 待补充 | `Recording.status` |
| Recording | `rejected` | 暂不能处理 | `Recording.status` |
| RecordingEntryLink | `suggested` | 处理中 | `RecordingEntryLink.status` |
| RecordingEntryLink | `accepted` | 已采用 | `RecordingEntryLink.status` |
| RecordingEntryLink | `disputed` | 待补充 | `RecordingEntryLink.status` |
| RecordingEntryLink | `rejected` | 暂不能处理 | `RecordingEntryLink.status` |
| EvidenceLink | `submitted` | 处理中 | `EvidenceLink.relation_type` |
| EvidenceLink | `supports` | 已采用 | `EvidenceLink.relation_type`（仅表示支持关系） |
| EvidenceLink | `disputes` | 待补充 | `EvidenceLink.relation_type` |
| UsageAttestation | `true` | 已采用 | `UsageAttestation.active`（布尔值） |
| UsageAttestation | `false` | 暂不能处理 | `UsageAttestation.active`（布尔值） |

`EvidenceLink` 的关系值来自 `relation_type`，不存在 `status` 字段。
`UsageAttestation.active` 在 API 中为布尔值；展示边界调用
`contributionStatus('usage_attestation', active)` 时将 `true` / `false` 分别映射为
`active` / `inactive` 展示键，同时兼容已有字符串调用。展示键不是 API 的内部状态值。

### 三种使用场景的固定短文案

| 场景 | 固定文案 | 使用边界 |
| --- | --- | --- |
| 列表 | 使用上方映射中的“列表短文案” | 只显示阶段和记录状态，不下事实结论 |
| 详情 | 使用上方映射中的“用户说明”与“下一步” | 必须保留原始资料、来源和分歧说明 |
| 贡献提交成功 | **已提交，等待审核** | 适用于录音、文字、地区和纠错提交；不得写“已收录”或“已经修正” |
| 草稿保存成功 | 草稿已保存，可稍后继续 | 这是本地草稿操作，不代表已经提交审核 |
| 提交失败 | 提交未完成，内容已保留，请稍后重试 | 失败时不得暗示已经进入审核 |

### 词条与义项

| 对象 | 内部状态 | 列表短文案 | 用户说明 | 下一步 |
| --- | --- | --- | --- | --- |
| Entry / EntrySense | `draft` | 初稿 | 已经记下，仍可补充写法、分义或读音。 | 打开详情继续补充或等待整理 |
| Entry / EntrySense | `reviewed` | 已整理 | 结构已经整理过，不代表唯一正确。 | 查看详情和证据 |
| Entry / EntrySense | `disputed` | 有不同说法 | 保留不同整理意见或依据。 | 查看意见并按现有入口补充资料 |
| Entry | `redirected` | 已并入另一词条 | 已记录跳转关系，原有资料仍可追溯。 | 查看当前词条 |

### 写法与地区读音

| 对象 | 内部状态 | 列表短文案 | 用户说明 | 下一步 |
| --- | --- | --- | --- | --- |
| EntryWriting / PronunciationVariant | `draft` | 初稿 | 已记录但仍待整理。 | 查看详情并补充依据 |
| EntryWriting / PronunciationVariant | `reviewed` | 已整理 | 已整理，不表示取代其他写法或读法。 | 查看关系、范围和来源 |
| EntryWriting / PronunciationVariant | `disputed` | 有不同说法 | 存在不同整理意见或依据。 | 查看依据并补充资料 |
| EntryWriting / PronunciationVariant | `rejected` | 本次未采用 | 当前结构未采用，原始资料仍保留。 | 查看原因和现有入口 |

### 录音与录音—词条关联

| 对象 | 内部状态 | 列表短文案 | 用户说明 | 下一步 |
| --- | --- | --- | --- | --- |
| Recording | `draft` | 初稿 | 录音已记下，仍可补充资料。 | 打开录音详情 |
| Recording | `published` | 已公开 | 对外可见，不表示官方认证。 | 播放并查看关联和证据 |
| Recording | `disputed` | 有不同说法 | 相关整理存在不同意见或依据。 | 查看意见和证据 |
| Recording | `rejected` | 本次未采用 | 当前未进入公开结构，原始提交仍保留。 | 查看原因和现有入口 |
| RecordingEntryLink | `suggested` | 关联待确认 | 有人提出了录音与词条的关系，但还未确认。 | 查看关联依据 |
| RecordingEntryLink | `accepted` | 已建立关联 | 关系已接受，不表示录音内容获得权威认证。 | 查看角色、义项和证据 |
| RecordingEntryLink | `rejected` | 关联未采用 | 这次关系未采用，录音和词条仍可独立保留。 | 查看原因或现有入口 |
| RecordingEntryLink | `disputed` | 关联有不同说法 | 关系存在不同解释，相关依据会被保留。 | 查看解释和依据 |

### 证据关系与本地使用确认

`EvidenceRecord` 本身没有审核状态；它是不可原地覆写的原始资料。只有它与对象的
`EvidenceLink` 有关系状态：

| 对象 | 内部状态 | 列表短文案 | 用户说明 | 下一步 |
| --- | --- | --- | --- | --- |
| EvidenceLink | `submitted` | 已提交依据 | 原始依据已记录，整理结果不会覆盖原文。 | 查看原文、出处和关联对象 |
| EvidenceLink | `supports` | 支持该说法 | 被作为支持依据，不表示单独证明语言事实。 | 查看支持对象和其他依据 |
| EvidenceLink | `disputes` | 对该说法有疑问 | 被作为质疑依据，原始资料仍保留。 | 查看质疑对象和相关依据 |
| UsageAttestation | `true` | 已记录本地用法 | 记录了用户在所选范围内的用法确认，不代表官方认证。 | 查看或补充说明 |
| UsageAttestation | `false` | 已撤回本地用法 | 当前不再作为有效记录展示。 | 仍使用时重新提交说明 |

## 禁止词与边界

除非未来有明确的治理模型、操作者和证据链，否则前台不要把以下词作为上述状态的同义词：

- `官方认证`、`权威认证`、`正品认证`
- `审核通过`、`审核失败`
- `证明正确`、`语言事实已确认`
- `社区投票通过`、`AI 判定正确`

允许使用的限定表达包括：“已整理”“已公开”“已建立关联”“支持该说法”“有不同说法”。
这些词只描述当前记录或流程，不对语言事实作超出证据的结论。

## 当前技术缺口

- `GET /contributions/me/` 当前返回贡献类型、摘要、时间和目标 ID，尚未返回每条贡献的对象类型与状态；本任务不改变该接口。
- 贡献页目前只展示活动摘要，不直接展示本映射表；接入页面应另建小范围 UI 任务，并复用本模块。
- `rejected` 等状态的用户侧重新提交入口并非所有对象都有，因此文案只要求查看原因或使用现有入口，不承诺“修改后重提”。
- `CurationAction` 是不可覆写的整理日志，不是一个“审核结果状态”；前端不要为它虚构 `approved` 或 `failed` 状态。

## 验收清单

- [x] 覆盖当前 V2 模型中用于贡献展示的真实状态。
- [x] 每个映射包含列表短文案、详情说明和下一步。
- [x] 明确证据、社区互动和 AI 不等于语言事实认证。
- [x] 未知状态有安全兜底。
- [x] 记录需要后续产品/技术改动的接口和 UI 缺口。
