# 后端开发指南

## 活动领域

`guantou` app 的公开事实来源是 Entry / Recording V2：`Entry`、`EntrySense`、
`WritingForm`、`Concept`、`PronunciationVariant`、`Recording`、
`RecordingEntryLink`、`EvidenceRecord`、`UsageAttestation` 和整理治理模型。

旧 Can、Nameplate、Flavor、Package、Pronunciation、Shelf、Post、Comment 模型和历史
migration 只用于数据归档与迁移回溯。不要为它们新增 router、view、serializer、service
或写入流程，也不要从 V2 代码导入旧的自动权重选主逻辑。

## 接口与权限

公开资源由 `guantou/urls.py` 的 DRF router 挂在根路径。匿名用户可读取公开资料；写入
必须认证。对象贡献者可维护自己的初稿，词条整理员维护词条结构，地区整理员维护授权
地区范围内的读音、录音和关联。重要整理操作写入 `CurationAction` 前后快照和理由。

`EvidenceRecord` 是不可覆写证据；修订结构化字段不能修改原文。用户删除后核心资料通过
`SET_NULL` 匿名保留。`EntryBookmark` 是私有阅读清单，不参与排序、审核或权威计算。

## 方言与查询

方言用稳定数据库 ID 关联。父节点允许作为真实的宽泛范围；默认查询精确匹配，只有明确
的 `dialect_scope=subtree` 才展开后代。普通 serializer 返回自然名称与路径标签，限定码
只用于 resolve、导入和管理工具。

词条查询同时指定 `source_type` 和 `source` 时，来源类型与出处文字必须匹配同一条
证据；单独使用任一条件仍可查询。自由关键词保持跨字段检索，不要求与来源筛选
命中同一条证据。

## 应用边界

账户在 `user`，公告在 `announcements`，站点配置在 `siteconfig`，文件在 `files`，通知在
`inbox`，审计在 `audit`，装扮在 `themes`，产品事件在 `productanalytics`。复杂跨模型
操作放在 service 层并使用事务；异常统一返回 `{ message, code, data, request_id }`。

## 迁移与验证

只新增 forward migration，不修改已发布 migration。旧库 importer 必须只读来源、可重复
执行且不重复创建 V2 数据。后端变更至少运行 `make backend-check` 和
`make api-contract-check`。
