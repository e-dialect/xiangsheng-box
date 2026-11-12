# 兴化语记 → 乡声集盒：核心能力继承核对

## 范围与证据版本

2026-11-12 首轮源码核对，非生产迁移验收。旧 Web 本地检出 `a84cbd7eabacfd31ad1727fc77ca96c5f471ecf7`，旧 uni-app `89de695e986b89a04ac09d9015f3f4826a06e09c`；新集盒基线 `14ab7fc9475b3931b434093e34fae094a6fd449d`。代码/路由存在不等于当前线上正常使用；未检查旧版用户使用统计，不将未验证项目称作完整覆盖。

负责人本轮明确：录音是核心必备，先前“文章录音可以暂缓”已纠正为“文章和音乐”；多语言、子方言、细口音表达是主要升级。莆田、仙游、山区是产品组织意图，不能冒称已验证语言学谱系，不能把已有原始地区标签强制重挂。用户还要求同一地方可并列不同词典的解释与俗写异体、跨地比较同义不同词/同词不同义；保留来源和分歧，不自动融合成唯一答案。

## 第一轮矩阵

旧路径相对 `hinghwa-dict-web/src`，标注 uni 的相对 `hinghwa-dict-uni-app/src`；新路径相对本仓库 `frontend/src`。

| 用户任务 | 旧版真实入口/代码 | V2 证据与当前判断 | 下一步/已有跟踪 |
| --- | --- | --- | --- |
| 查词、看释义及写法 | `views/Words/WordDetails.vue`、`views/SearchResult.vue` | `pages/search.vue`、`pages/entries/details.vue` 已展示分义、写法、地区、读音；不是完整旧搜索语义等价证明 | #403、#441、#437；补真实查询样例 |
| 听完一个词的不同真人声音 | uni `pages/words/pronunciations.vue` 支持 `loadMorePronunciations` | 详情仅请求前 50 条且丢弃 next，后续声音无入口，确认缺口 | #582，本轮实现按需续页、保留已有声音及失败重试 |
| 录音、上传、草稿恢复 | `components/Pronunciation/Recording.vue`、`views/Tools/QuickRecording.vue`；uni `pages/words/pronunciations/upload.vue` | `pages/recordings/create.vue`、`AudioCapture.vue`、`pages/recordings/drafts.vue` 有 V2 流程；不能据此称批量录音节奏完全继承 | #442、#425、#407；现有 #569/#570/#576/#579 优先复用，不重开相同修复 |
| 词单/收藏整理 | `views/Words/WordList/`；uni `pages/lists/` | `pages/collections/`、`pages/users/bookmarks.vue` 已有词集/收藏；旧词单数据与链接迁移未验收 | #406、#432、#433 |
| 读音按声母/韵母/声调选字 | `views/Tools/Conditions.vue`；uni `pages/tools/condition.vue` | V2 搜索有 IPA/romanization 条件，但无等价声韵调选择入口；保留的静态拼音文件不算实现 | 待独立 Leaf；应按语言加载音系配置，不把莆仙选项套给其他语言 |
| 一串汉字的拼音速查/字音资料 | `views/Tools/Characters.vue`、`views/Pinyin.vue`；uni `pages/tools/pinyin.vue` | 没有等价页面；词条读音列表不等于逐字、多音字、文白读关联 | #533 / #441 的范围边界内拆分，不默认用第一读音 |
| 日常用语对照 | `views/Tools/DailyExpressions.vue` 请求 `/website/daily-expression`；uni `pages/tools/daily-expression/index.vue` | 无独立入口；词集可能承载但尚未验证旧资料映射 | 待独立 Leaf，保留语种、地区与来源 |
| 亲戚称谓计算 | `views/Tools/Relative.vue`、`components/Tools/relative.js`；uni `pages/tools/relative.vue` | V2 无对应路由，不等于旧版已弃用 | #517 是未来投稿/审核闭环，不等于基础计算器已承接；需单独界定核心承接 |
| 语音识别/翻译 | `views/Translation/xtpTranslation.vue`、`ptxTranslation.vue` | 旧入口存在，服务有效性/授权/质量未验；V2 未证明等价 | #444、#437；不得据旧按钮存在承诺真实识别能力 |
| 测试/趣味学习 | uni `pages/quizzes/` | V2 无等价页面；需保留娱乐价值但先确认题库、权益和复用方式 | #438，拆最小有用任务而非照搬旧架构 |
| 排行/奖励/认证 | `components/Pronunciation/RankList.vue`、`views/Rewards/`、`components/User/CertificatePane.vue` | V2 贡献档案、主题权益不等于旧积分和证书承接 | #438；不自动迁移财产式权益，不删除历史记录 |
| 评论、消息及审核 | `components/Articles/CommentList.vue`、`views/Tools/RecordConfirming.vue`、`WordConfirming.vue` | `DiscussionThread.vue`、`pages/mails/`、`pages/curation/` 有通用能力 | #466、#403；数据与权限仍需独立核对 |
| 文章与音乐 | `views/Articles/`、`views/Music/` | 不列本轮强制实现，仍保留资产盘点 | #438，后续明确是否纳入，不等同永久删除 |

## 升级能力不能只看数据库字段

- **多语言/地区**：`Dialect` 树、`DialectSelector.vue`、`utils/dialectTree.js`、搜索 exact/subtree 已有基础。父地区的证据不能推广为全部子地区；未知地区不能改成猜测的精细口音。
- **多来源、多解释**：后端 `EntrySense`、`WritingForm`、`PronunciationVariant`、`EvidenceRecord` 已具备部分结构。详情页有分义、俗写等写法、读音和证据统计，不等于已经实现“每一解释可并排追到哪本词典哪一页”的用户体验。需要核 serializer、实际数据和公开入口后再标完成。
- **跨地比较**：#533 已记录莆田/仙游/兴化山里导航分组及不静默 fallback 的约束，原计划春节后。最新用户强调主线价值，但本轮不擅自改其排期或以一张表代替可用比较页。
- **研究参考**：原录音、原释义、书目页码、贡献者与授权、争议状态应留存。AI 候选、点赞、频次不成为正确性裁判。不恢复历史 Can/Nameplate 模型作为新代码的活动模型；“铭牌”作为用户表达理念，不据此改系统命名。

## 后续执行方式

核心继承缺口由 #584 跟踪。先复用 #431–438 的迁移与盘点事项，再按核心用户任务拆实现 Leaf。每项要分别记录代码存在、可操作入口、必要数据、真实验收、PR 合并/上线状态；不得把草稿 PR 写成已上线。当前轮仅完成 #582 的代码修复，不能据此宣称整体功能继承完成。
