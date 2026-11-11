# 兴化语记 Web 功能与交互承接清单

2026-11-12，关联 #584。旧 Web `e-dialect/hinghwa-dict-web` @ `a84cbd7eabacfd31ad1727fc77ca96c5f471ecf7`；uni-app @ `89de695e986b89a04ac09d9015f3f4826a06e09c`；集盒基线 `14ab7fc9475b3931b434093e34fae094a6fd449d`。

**旧 Web 是独立验收来源，不能以 uni-app 功能清单代替。** 此表覆盖旧 Web 路由入口，并指出需继续细验的交互。源码存在、API 可用、线上用户可用、数据已迁移分别记录；本轮没有生产数据库或线上完整验收。集盒使用 uni-app 技术栈不意味着只做手机端，应在 H5 桌面布局和键盘使用中保留用户任务。

## 路由及交互矩阵

旧 Web 路径来自 `src/router/index.js`，组件路径相对 `src/`。uni 栏为相对 `src/pages/` 的页面组；“无等价”指本轮未见等价页面，不代表后端绝无相应数据。

| Web 路由 / 组件 | 必须纳入核对的 Web 交互 | uni-app 对应 | 集盒 V2 现状 / 后续 |
| --- | --- | --- | --- |
| `/`→`/Home`，`views/Home.vue` | 首页发现、每日词、轮播与任务入口，不只复制装饰 | index / home | `pages/index` 听乡音流与任务，旧每日词价值需单验；#440 |
| `/About` | 平台说明、参与方式 | 关于页需细验 | 新产品说明与许可应核实；不以品牌更名代替内容承接 |
| `/search` | 输入词检索，旧页同时请求 words/articles | search | 新 Entry 检索已有；文章按最新要求暂缓，不因此阻塞查词；#441/#437 |
| `/Dictionary`，`views/Dictionary.vue` | **逐级音序查词**，可选下一音节随前序变化、前缀字母筛选、移除已选音节 | tools/dictionary | V2 无等价入口；不可用“已有拼音文本搜索”勾完成 |
| `/pinyin` | 音系/拼音资料浏览 | tools/pinyin | 无等价页面；应按语言加载配置 |
| `/tools` | 工具发现与清晰用途说明 | tools/index | 无等价工具入口，须服务真实任务而非复制大图网格 |
| `/tools/conditions` | 声母、韵母、声调选择与缺省条件查字；结果读音播放 | tools/condition | 无等价选择 UI；区分拼音全文搜索；#584 |
| `/tools/characters` | 一串字逐字拼音速查，保留多音信息 | tools/pinyin 部分重叠 | 未承接；需保持字位置及正确读音，不取第一读音代替 |
| `/tools/DailyExpressions` | 日常表达的多语对照与播放 | tools/daily-expression/index | 可评估词集承载，数据/来源未验 |
| `/tools/Relative` | 连续选择亲属关系、撤销/复算、方言称谓 | tools/relative | 无等价入口；#517 未来投稿闭环并非基础计算器完成 |
| `/tools/QuickRecording`、`/tools/QuickRecording/RecordRank` | 批量连续录制、审核反馈、贡献排名 | words/pronunciations/upload、ranking | V2 单条录音/草稿已有，批量节奏和排行另验；#442/#425 |
| `/tools/RecordConfirming`、`/tools/WordConfirming` | 管理员审查录音和词条，不向普通用户泄露管理动作 | 无完整等价需核 | V2 curation 工作台已有，逐项核权限与待处理结果 |
| `/words/Create`、`/words/:id`、`/words/:id/edit`、`/application/:id` | 词条创建/编辑/申请；详情中释义分项、**例句/俗语/解释**、普通话词、相关词、附注、贡献者、录音表及贡献入口 | words/details、pronunciations 等 | V2 有分义/写法/录音，但 examples 未展示；本轮先补该展示。相关词、附注与编辑流程不以已有页面替代验收；#403 |
| `/wordlist`、`/wordlist/editor`、`/wordlist/:id` | 创建/编辑词单名称描述、挑选词汇、列表详情 | lists/index、upload、details | V2 collections 有通用底座；旧数据/权限/编辑语义待核；#406/#432 |
| `/login`、`/register`、`/forget` | 登录、注册、找回，返回原任务、防重复提交 | login 页面组 | V2 已有；在途 #571/#577/#578 等复用，不重开 |
| `/users/:id`、`/users/certificate/:id`、`/settings`、`/notification` | 公开贡献档案、证书、资料编辑、通知，Web 录音表可分页 | users、mails | V2 档案/账户/消息有入口，证书与历史消息权益未验；#344/#397/#438 |
| `/rewards`、`/rewards/detail/:id`、`/rewards/transactions`、`/admin/rewards` | 奖励详情、兑换/流水、管理员操作及权限 | products / points | V2 主题权益不等于旧账本；保留历史资产，迁移策略另审；#438 |
| `/PuxianExam`、`/PuxianExam/Create`、`/PuxianExam/:id`、`/PuxianExam/Research` | 题目浏览、创建编辑、作答、研究/统计；核旧动态路由顺序是否遮挡 Research | quizzes 页面组 | 无等价入口；题库权益/数据与学习任务先审，再拆最小可用；#438 |
| `/Translation`、`/ptxTranslation`、`/xtpTranslation` | 双向语音/文字服务及清晰错误反馈 | 无完整等价需核 | 旧服务有效性/授权未验；#444/#437，不能凭按钮存在宣称模型可用 |
| `/articles`、`/articles/create`、`/articles/:id`、`/articles/edit/:id` | 文章浏览、写作、评论、关联内容 | articles | **暂缓评估**，不自动删除数据；#438 |
| `/music` | 音乐列表、播放与控制 | 旧移动端覆盖需核 | **暂缓评估**；不与核心录音混淆；#438 |
| `/NotFound`、`/Forbidden`、未知路径 | 缺页/无权限后的下一步、旧书签兼容 | error/not-found | V2 错误页已有，旧 URL 映射需单验；#429/#432 |

## 本轮 Web 独立缺口：释义例句（#587）

旧 `views/Words/WordDetails.vue` 调用 `components/Word/DefinitionShow.vue`，后者按释义展示 `type/content/explain` 的例句或俗语。V2 `EntrySenseSerializer` 已输出 `examples`，但 `pages/entries/details.vue` 仅展示 gloss/usage_note/concepts，遗漏了已有例句。

本轮以 `SenseExamples.vue` 在对应义项下展示已记录内容：支持字符串和明确文本对象（`content/explain/type`，或 `text/translation`），缺内容不补造，不将复杂对象转为 `[object Object]`。使用文本插值而非 HTML，长句可换行，沿用主题令牌，不在桌面硬设巨大边距。例句始终归属当前义项，不跨义项拼合，也不把不同来源融合为唯一解释。

**边界**：不猜测旧原始 definition 字符串中的例句边界，不修改旧 importer，不声称线上已有完整结构化例句；未支持结构另做数据契约审计。需要词典/页码追源的字段与完整多来源比较体验仍单独推进。无例句时不展示空框，也不以 AI 生成例句填空。

## 优化而非机械复制

- 桌面与手机都能完成用户任务：信息层级、键盘按钮、换行、分页、失败恢复；不硬搬旧固定边距和仅图片工具卡。
- 语言/子方言/细口音可配置；莆田、仙游、山区作为产品分组，不重写成未经核验的语言学分类。
- 多辞书解释、俗写异体、同义异词与同词异义保留来源和争议。旧入口补齐不能成为自动合并解释的理由。
- 优先普通用户听查录和使用理解。文章与音乐暂缓，录音核心；大规模非功能扩建不阻塞此轮。
- #584 持续拆叶子；本文件和局部 PR 不是全量迁移完成声明。
