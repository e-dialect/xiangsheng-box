# 方言数字基建计划
## Dialect Commons Contributor Guide

> 目标不是“给莆仙方言再加几个字段”，而是让任何一种方言都能被可靠记录、整理、检索、保存和复用。

## 1. 负责什么

- Entry / Recording / Dialect / Evidence 的长期语义；
- 旧数据迁移与数据质量；
- 搜索、引用、导出；
- provenance / rights / consent；
- 多方言压力验证；
- 长期 RecordingSegment / Annotation 演进。

## 2. 必须保护的 V2 原则

### Entry 与 Recording 独立

录音可以在不知道专业写法时存在；词条也可以暂时没有真人录音。

### 事实与解释分开

事实尽量 append-only / 可追溯：

- 原始录音；
- 贡献者原话；
- 来源；
- 授权；
- 原始地区自述。

解释允许修订、竞争、supersede 和人工审核：

- 这是哪个 Entry；
- 写法 / IPA / 编号义；
- 方言范围；
- 变调分析。

### Dialect 不是行政区自动展开

父节点声明不代表所有子节点都使用。默认精确，只有显式 subtree 查询才包含下级。

### 不建立自动“官方答案”

官方来源、点赞、支持数、AI、相似度都不能自动裁决唯一正确写法或读音。

## 3. 长期方向

Recording 表示一次媒体事实，不应无限塞入语言学字段。

中期目标：

```text
Recording
  └─ RecordingSegment
       ├─ transcript annotation
       ├─ writing / IPA / romanization
       ├─ gloss / sandhi
       ├─ speaker
       ├─ dialect claim
       └─ Entry links
```

跨方言稳定实体使用正式 schema；方言特有内容采用 versioned annotation schema，而不是“每来一个方言加一列”或无约束 JSON。

## 4. 兴化语记迁移

兴化语记是第一个真实迁移验证场，而不是第二套平台。

当前仓库已有 `import_hinghwa_legacy`，不得另起平行导入器。迁移必须：

- 来源库只读；
- Legacy → 乡声集盒单向；
- dry-run / rehearsal；
- ID 映射可追溯；
- Evidence 保真；
- 账号迁移可审计；
- cutover 前有数据质量报告；
- 不在生产环境第一次尝试。

## 5. 多方言验收矩阵

核心 schema 至少能合理表达：

- 莆仙：连读变调、文白异读、多地区、多写法；
- 闽南：汉字/罗马字、多套正字、同义异词；
- 粤语：粤拼、字音/词音、口语词、多地区；
- 吴语：细粒度地域差异、发声态、连续地理变化；
- 客家：跨地区变体；
- 官话地方片：与普通话接近但不等同；
- 无成熟正字：只有录音+地区+大意也合法；
- 长篇田野录音：多 Segment、多说话人、多 Entry、混合语言。

## 6. AI-native 额外底线

涉及 model / migration / Evidence / Dialect / identity / legacy import / public API 时，作者必须说明：

```text
数据语义
兼容性
实际验证
失败模式
AI 帮助范围
本人重点检查内容
```

## 7. Definition of Done

至少检查：原始证据是否保留、解释是否可修订、是否产生单一方言假设、migration 是否 forward-only、是否可预演/可追溯、OpenAPI/ADR 是否同步、多方言压力案例是否仍成立。
