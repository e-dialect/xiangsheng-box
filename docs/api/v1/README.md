# Entry / Recording API 说明

> 状态：当前公开契约。字段级定义见 [`openapi.yaml`](openapi.yaml)。

## 领域语义

- `Entry`：同一个词及其读音身份。无录音、写法尚不确定的词条也合法。
- `EntrySense`：同一 Entry 下的相关编号义；不同读音、词源或核心意义应拆为 Entry。
- `WritingForm`：汉字、俗写、借字、拟音、罗马字等可检索写法。
- `Concept`：WALK、RUN 等跨语言抽象概念，只用于关联发现。
- `PronunciationVariant`：某一 Entry 在特定地区的读音变化。
- `Recording`：音频、使用地区、录制者、类型和贡献者原始大意，不保存设备位置。
- `RecordingEntryLink`：录音与词条的多对多关系，角色为 `primary / mention / competing`。
- `EvidenceRecord`：贡献者原话或文献原文，不允许覆写。
- `UsageAttestation`：“我这里也这么说”的地区范围补证。

“行走的行”和“银行的行”是不同 Entry。“走＝步行”和“走＝奔跑”也可以拆成不同
Entry，再分别关联 WALK、RUN。搜索相同写法时返回多条清楚标注读音和大意的结果，
不会因支持数、权重或 Concept 自动合并。

## 主要路径

- `GET /entries/`：词条优先搜索；支持地区、录音有无、状态、IPA、罗马字等筛选。
- `POST /recordings/`：最低提交音频、使用地区和大意；写法、音标可后补。
- `POST /recording-entry-links/`：提出主要词条、句中词或竞争解释。
- `POST /usage-attestations/`：提交地区使用补证。
- `GET /entries/bookmarks/` 与 `PUT|DELETE /entries/{id}/bookmark/`：私有收藏。
- `GET /curation/`、`GET /curation/tasks/`：按授权显示整理工作台。
- `GET /contributions/me/`：个人录音、补证、修订和地区足迹。
- `GET /curation/actions/` 与 `GET /curation/actions/{id}/`：登录后查看本人历史；有效整理员还可按角色、目标可见性和历史地区范围读取协作者记录。
- `POST /curation/actions/`：仅 staff 或有效整理员可提交；新动作保存 `authority_snapshot`，用于解释当时的角色、范围和有效期，不依赖可变的当前 grant。

## 地区修改与历史读取边界

Entry、Recording、PronunciationVariant 仅在 `draft` 且该目标没有语义动作历史时允许普通接口修改地区。
Entry 的义项、写法关联，以及 Recording 的录音关联已有整理状态或语义动作历史时，父对象也受保护；
关联历史版本不因 `is_current=false` 而被排除。PronunciationVariant 使用自身独立的地区范围。
其他状态或已有整理历史的目标需通过治理操作提供依据与理由；同值保存和非地区字段维护不受此规则阻止。
普通 API 无法把已审核对象的地区悄悄改掉并保留其审核状态；staff 也需使用治理路径。

地区整理员读取另一人的范围决策时，目标当前范围及快照中的前后范围都须处于其授权子树；
只有当前地方权限不能读取原上级范围的决策。词汇整理员按其词汇对象职责读取，录音关联还需录音可见。
无法判断历史范围或目标已删除时，对其他人的读取采取拒绝策略；本人仍能查到自己的历史。
协作者响应保留决策理由、前后快照与授权快照，actor 只保留 id，grant 管理备注不公开，证据 ID 按来源可见性过滤。
词汇整理员可读取目标录音及快照中竞争词条均当前可见的 `preserve_competing` 历史；这不授予其他录音审核或地区缩小历史的读取权限。
已到期/撤销的 sole-grant 操作者可读取自己的旧动作，但不能借此提交新动作或查他人的记录。

`authority_snapshot` 保存版本、采集时间、grant/staff 模式、角色、当时方言标识/路径、有效期及当时撤销状态。
不保存授权人的个人资料或管理备注；已有记录未回填，读取时显式显示 `unavailable`。
它受 CurationAction 的模型 save 和只追加 API 保护，不是对直接 ORM/数据库管理写入的防篡改保证。

## 方言范围

`Dialect` 是可停在任一级的树。贡献者可以只选“莆仙方言”，也可以继续选到“莆田 ›
城里”。父节点只表示已知范围，不推断所有子节点都使用。默认筛选为 `exact`；显式传
`dialect_scope=subtree` 才搜索所选节点及后代。普通响应提供自然名称和路径标签，内部
限定码只用于解析和管理工具。

## 历史数据

旧 Can/Nameplate/Flavor/Package 等表保留在数据库中作为只读归档，以便核对迁移来源。
它们没有公开 router、前端页面或自动选主执行路径。旧库导入器只创建 V2 对象，每个旧
词条先形成一个可追溯 Entry，每条旧录音只形成一个 Recording；含编号义和重复写法的
记录只生成待审核候选，不自动拆合。
