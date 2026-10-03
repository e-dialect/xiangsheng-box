# 兴化语记旧 URL / 小程序入口 → 新用户旅程映射

关联：[#429](https://github.com/e-dialect/xiangsheng-box/issues/429)，与 [#428](https://github.com/e-dialect/xiangsheng-box/issues/428)、[#432 / CM-03](https://github.com/e-dialect/xiangsheng-box/issues/432) 对齐。调查：2026-10-03；新仓库基线 `95aaeb6`。

交付为路由审计和映射需求，不部署 redirect、不切 DNS、不导入生产数据、不归档旧仓库。称“高频”是任务的优先覆盖范围，当前没有访问日志，不能据此声称已测量访问量。

## 1. 来源、完整性与可复核清单

| 来源 | 固定版本 | 调查文件 |
| --- | --- | --- |
| 旧 Web | `8f4a6b67fac6fc171744cdc1c874c689b45b883d` | [router/index.js](https://github.com/e-dialect/hinghwa-dict-web/blob/8f4a6b67fac6fc171744cdc1c874c689b45b883d/src/router/index.js)、[pc2mob.json](https://github.com/e-dialect/hinghwa-dict-web/blob/8f4a6b67fac6fc171744cdc1c874c689b45b883d/src/router/pc2mob.json)、[Footer.vue](https://github.com/e-dialect/hinghwa-dict-web/blob/8f4a6b67fac6fc171744cdc1c874c689b45b883d/src/components/HeaderAndFooter/Footer.vue) |
| 旧小程序 / 移动 H5 | `330aa04df0b0423fedf513a683854c3415e96080` | [pages.json](https://github.com/e-dialect/hinghwa-dict-uni-app/blob/330aa04df0b0423fedf513a683854c3415e96080/src/pages.json)、[pc2mob.js](https://github.com/e-dialect/hinghwa-dict-uni-app/blob/330aa04df0b0423fedf513a683854c3415e96080/src/routers/pc2mob.js)、[mob2pc.js](https://github.com/e-dialect/hinghwa-dict-uni-app/blob/330aa04df0b0423fedf513a683854c3415e96080/src/routers/mob2pc.js)、`src/routers/*.js`、页面 `onShareAppMessage` 和 `services/shareMessages.js` |
| 旧后端 | `3a42c2656640330b84d8cb3d8666457f7276b4fa` | `HinghwaDict/urls.py`、`word/word/urls.py`、`word/pronunciation/urls.py`；用于区分对象和 API，不将后台 API 当用户落地页 |
| 新仓库 | `95aaeb648d1006f1c957c5e866d744f91a1a6bd7` | `frontend/src/pages.json`、搜索 / 录音 `onLoad`、[backend/guantou/guantou/legacy_import.py](https://github.com/e-dialect/xiangsheng-box/blob/95aaeb648d1006f1c957c5e866d744f91a1a6bd7/backend/guantou/guantou/legacy_import.py) V2 导入路径与台账 |

[逐项清单 CSV](assets/x4/legacy-route-inventory.csv) 对 Web 登记路由、小程序登记页、双向桥接产生的别名、分享和导航生成器路径逐项记录来源行号、映射键、目标、fallback 和风险；同一路径的不同来源保留多条记录，便于查证。`source_pattern` 保留源码原始字符串，`legacy_route` 展开相对路径与工具数据中运行时添加的 `/pages` 前缀。登记页包括受保护编辑和管理入口，标注为需要登录 / 权限，不将“源码可发现”解释为匿名可访问。

清单计数：Web 登记路由 48、小程序登记页 57、Web 桥接来源模式 48、移动桥接来源模式 59、实际分享生成器 16、实际导航生成器 55、工具数据入口 8，共 **291 条来源记录**。按 `(platform, legacy_route)` 去重后为 **183 项**；按 `(platform, source_pattern)` 去重后为 **250 项**；单独按 `source_pattern` 去重后为 **213 项**。其中 `legacy_route` 是展开后的入口，`source_pattern` 是源码原始字符串，两种列的计数不可混用。搜索分享采用 `const path = ...` 再返回变量，也计入生成器；不能只搜索 `path:` 而遗漏它。

CSV 使用 **UTF-8（无 BOM）** 编码，按标准 `utf-8` 解码即可读取首列名 `platform`，无需去除隐藏的 BOM 字符。

所有本次审计读到的源码路线均有明确处置。源码版本之后的生产差异、旧部署配置中的服务端 rewrite、搜索引擎残留和更多分享参数，需要后续用日志补充；本表不宣称覆盖未知生产入口。旧仓库许可证入口为各自 `LICENSE`（AGPL-3.0，部分依赖另有许可证）；本交付只归纳路由事实并引用源码，不复制实现或历史文章正文。

## 2. 目标简称与当前可用性

| 简称 | 目标 / 行为 | 当前状态 |
| --- | --- | --- |
| S | `/pages/stations/index?station=hinghwa`，兴化语记站 | **建议路由，未登记到 main**；落地前使用 H，并展示承接说明 |
| H | `/pages/index` | 已登记通用首页；不能宣称已自动筛选莆仙 |
| Q | `/pages/search?keywords=<URL 编码文本>` | 已登记；当前消费 `keywords` / `key`；旧 scope 不能无损等价为新筛选 |
| E | `/pages/entries/details?id=<映射的 V2 Entry ID>` | 已登记；依赖可见性和旧 ID 映射 |
| R | `/pages/recordings/details?id=<映射的 V2 Recording ID>` | 已登记；依赖可见性和旧 ID 映射 |
| C | `/pages/collections/details?id=<映射的 V2 Collection ID>` | 路由已有；**旧词单映射不存在**，当前用 S → H fallback |
| REC | `/pages/recordings/create`；有效 Entry 时可带 `entry_id` | 已登记；仍执行通用权限、字段确认与 capability gate |
| ME | `/pages/users/me` | 已登记；属于当前登录主体，旧用户 ID 不能作为“我” |
| CUR | `/pages/curation/index` | 已登记；仅授权整理员可用 |

CSV 中目标为 S、E、R、C 的记录表达承接设计或有条件目标，不代表已经接通旧域名。所有 S fallback 在 Station 落地前继续退化为 H；无映射的对象必须先说明“暂未找到可公开访问的对应资料”，提供用户主动搜索和回站动作，不能静默跳去无关内容。

## 3. 主路由类型映射表

所有主类型的确切路径、大小写、源码证据见 CSV。静态 `/words/Create`、`/wordlist/editor`、`/PuxianExam/Research` 等须先于动态 ID 路径匹配；不得把 `Create` 当旧 ID。

| 旧 URL / 入口类型 | 新目标 / 用户旅程 | 所需映射键 | fallback | 风险 / 条件 |
| --- | --- | --- | --- | --- |
| `/`、`/Home`、`/pages/index`、`/pages/home` | S，认出品牌 → 查 / 听 / 录 | 登记 profile，不需对象 ID | H + 承接说明 | 保留品牌；不能直接照搬旧工具宫格 |
| `/pages/index?status=me` | ME，保持“我的账户”意图 | `status` 只表达视图，不携带旧身份 | 通用登录 / H | `routers/user.js` 真实生成的参数别名，不能忽略后改去品牌首页 |
| `/About` | S 的关于 / 历史说明 | 已 review 的文案与历史链接 | H | 品牌说明需评审；不承诺未上线能力 |
| `/search?key=…`、`/pages/search?keywords=…&index=…` | Q | 文本只解码一次再编码；`index` 表达旧词语 / 字音 / 文章 scope | Q 空查询，或 S → H | `key` / `keywords` 同时出现且冲突时要求重输；字音 / 文章范围不能伪装成新 Entry 等价搜索 |
| `/words/:id`、`/pages/words/details?id=…` | E → 关联真人录音 → REC | `hinghwa-dict-backend / word_word / source_id / guantou.Entry` | Q（只有显式携带且有效的搜索文本）或 S → H | 不按同数值 ID、写法相似或首个结果猜测 |
| `/pages/words/pronunciations?word=…`、`/words/:id?tab=pronunciations` | E 的关联录音区；一个词可能有多条录音 | **word 参数是 `word_word` ID** | S → H / 用户主动 Q | 不能当 `word_pronunciation` 或直接选第一条 Recording；具体区块锚点待实现 |
| 单条旧发音 ID（仅 API / 历史参数证据，未发现独立公开页） | R | `hinghwa-dict-backend / word_pronunciation / source_id / guantou.Recording` | S → H / 用户主动 Q | 不虚构 `/pronunciations/:id` 公开路线；参数语义需实际来源证明 |
| `/tools/QuickRecording?word=…`、`/pages/words/pronunciations/upload?id=…` | 先映射词 → REC 带 V2 `entry_id`；无词上下文则通用 REC | `word_word` → Entry | 通用 REC + 告知关联词未找到 | 旧上传 `id` 也是词 ID；禁止复制旧授权或静默丢关联 |
| `/words/Create` | S → 查词 / REC；解释新共建方式 | 无直接对象映射 | H | 不恢复旧 WordCreate 表单；`id=0` 为旧 sentinel，不是有效对象 |
| `/words/:id/edit`、`/application/:id`、词条审核 | 先找 E；授权用户再进入 CUR | 编辑词用 `word_word`；**application ID 不是 word ID**，须单独查证 | Q / S → H | 禁止把申请 ID 猜成词 ID；权限重新验证，不从旧 URL 自动执行操作 |
| `/wordlist`、`/pages/lists/index` | 已有集盒列表，可说明旧词单待接入 | 列表不需对象键 | S → H | 不宣称历史词单已经迁入 |
| `/wordlist/:id`、`/pages/lists/details?id=…` | 有审计映射才 C；目前显示未接入 | CM-03 需另列旧词单来源与 Collection 映射；当前 importer 不覆盖 | S → H / 用户主动 Q | 不用旧 ID 直开新 Collection |
| `/wordlist/editor`、`/pages/lists/upload` | 已映射且获权限时才通用集盒编辑；当前退化 | 旧词单映射 + 编辑权限 | S → H | 不执行旧上传、覆盖或成员变更 |
| `/articles`、`/articles/:id`、`/pages/articles/index|details` | S 历史文章说明；只有权利和迁移决策明确才指向真实历史内容 | 文章来源键；当前 importer 无 article 映射 | S → H，明确未接入 | 不当成 Entry；不承诺新仓库有文章详情路由 |
| `/articles/create|edit/:id`、`/pages/articles/edit` | 历史编辑未接入说明 | 文章对象与编辑权限；不消费旧账号状态 | S → H | 不恢复编辑器或复制正文；旧小程序已限制文章编辑 |
| `/pages/articles/comments/details?article=…&comment=…` | 先保留文章 / 评论双来源键，当前未接入 | `article` 与 `comment` 分别记录 | S → H | 不能改挂到 Entry / Recording 讨论 |
| `/music`、桥接 `/pages/music` | S 历史音乐说明 | 来源和再发布权利；无现成映射 | S → H | `/pages/music` 未在旧 pages.json 登记；不假装可播放 |
| `/PuxianExam…`、`/Quiz`、`/pages/quizzes/…` | S 历史答题入口说明 | 题目 / 试卷 / 答题记录需分别审计 | S → H | 不能当作已上线 Campaign；成绩、证书和历史进度不能编造 |
| `/rewards…`、`/admin/rewards`、`/pages/products/…` | ME 的迁移说明（需登录）；展示状态而非承诺兑现 | 商品 / 订单 / 交易独立；非词条键 | ME / H | 积分、兑换、订单语义不等价于主题权益；管理页重新鉴权 |
| `/pages/users/me/points?id=…`、`pointmall`、`uploadgoods` | ME 的历史权益未接入说明 | 当前主体；points 的 `id` 因无登记页不能核实消费语义 | ME / H | `routers/points.js` 生成但未登记；注释不能作为身份映射证据，不恢复商品发布 |
| `/users/:id`、`/pages/users/details?id=…` | 经身份映射与公开性检查的通用用户详情 | `auth_user` → `auth.User`；仅服务器内部处理 | S → H | 不按旧用户数字 ID 直开新用户，不能推断“这是我” |
| 用户词语 / 发音列表、证书、文章 / 评论 / 喜欢列表 | 公开列表待迁移；本人可去 ME / 我的贡献 | 已确认身份及相应内容键 | ME（本人）或 S → H（公开旧链接） | 不是所有历史行为都有 V2 等价；不向访客展示私人列表 |
| 登录、注册、忘记密码及微信注册 | 对应通用登录流程 | 不继承 URL / 本地存储中的旧 token、主体、权限 | 通用登录 / H | 身份 cutover 属 #443 / #431；不能在本 Leaf 自动合并账号 |
| `/settings`、各用户设置页 | 进入已登记的通用账户设置，包括手机号设置 | 当前登录主体；不继承旧账号状态 | ME | 昵称、邮箱、密码、手机号等路由已登记；仍执行当前主体、验证与权限规则 |
| `/notification`、`/pages/mails/…` | 通用消息列表；旧详情明确暂未映射 | message 与 user 的单独映射，当前缺少 | 通用消息列表 / ME | 不能沿用旧 message ID；发送动作不自动执行 |
| `/Dictionary`、拼音、字符、条件查询、亲戚称谓、日常表达 | Q 或 S 历史工具说明；日常表达可到已 review 的专题 | 字符 ID 不等于 Entry ID；拼音 / 条件须独立筛选语义 | Q / S → H | `shengmu` / `yunmu` / `shengdiao` 不静默翻译为新查询过滤 |
| `/tools/QuickRecording/RecordRank`、`/tools/RecordConfirming` 等 | S 说明或授权 CUR | 排名无通用映射；审核需权限和对应对象键 | S → H / ME | 录音排名不等于审核；旧 pc2mob 有历史近似转换，不能照搬 |
| `/Translation`、`/ptxTranslation`、`/xtpTranslation` | S 历史翻译说明 | 无直接对象键；ASR/TTS 另属 #444 | S → H / Q | 不能把春节实验能力说成旧翻译已经迁移 |
| `/NotFound`、`/Forbidden`、`*`、未知入口 | 解释无法找到 / 无权访问；返回 S / H | 无 | H | 保留错误语义；不使用任意外部 return_to；403 不伪装成恢复成功 |

## 4. 分享、桥接与参数异常

- Web 处于 `history` 模式；`hinghwa.cn/<path>` 和 `m.hinghwa.cn/pages/<path>` 是源码证明的形式。本次未发现 hash 路由配置，`/#/…` 若生产日志出现，应作为别名另审计。
- `pc2mob.json` 的 `key → keywords` 与 `pc2mob.js` 的 `key` 保留并存；当前新搜索接受两者，但不要通配透传其他旧参数。
- 搜索分享携带 `index`，旧 scope 为词语 / 字音 / 文章；新 Entry 搜索不是后三类的全量替代。保留输入并明确搜索范围变化。
- `pages/words/characters/details.vue` 的分享生成器输出 `/pages/basics/characters/characters?id=…`，但登记的是 `/pages/words/characters/details`；两者都列入 CSV，异常分享路径走明确 fallback。
- `pc2mob.js` 产生 `/Quiz`、`/pages/music` 等别名，部分未登记；桥接存在不证明页面存在。
- `onShareTimeline` 源码固定到首页；不能推断朋友圈分享保留了词条上下文。
- 旧首页 `onLoad` 还接受 `status=basics|tools|InteractionPage|me`。`me` 有真实导航生成证据，映射 ME；其余分别表达旧首页 / 工具 / 互动视图，在通用等价能力未接入时说明后回 S → H；未知值不透传。它们是首页视图参数，不是新的对象来源键。
- 表中的路径按实际大小写保留。只对明确已登记的入口做匹配，正整数 ID 才可查台账；`0`、负数、重复 ID 参数、跨类型参数冲突或非数字输入均停止对象解析。
- `desktop=1` 是旧设备跳转开关，不是新产品业务参数；`token`、cookie、任意 URL、权限参数和 private 数据不进入新 deep link。保留必要输入须由目标白名单控制。
- 隐藏对象、删除对象和未映射对象对公开访客统一说明无法公开访问；不要暴露隐藏目标数量、作者身份或内部冲突候选。

## 5. CM-03 映射需求与当前 importer 的关系

当前活动 V2 importer 的 source system 为 `hinghwa-dict-backend`。词条台账查找必须带 `target_model=guantou.Entry`，发音台账带 `target_model=guantou.Recording`；旧文件仍保留 V1 归档常量，不能把 `Flavor` / `Can` 台账当活动目标。

| 来源键 | V2 目标 | 当前可调查证据 | #432 需明确的输出 |
| --- | --- | --- | --- |
| `word_word / source_id` | `guantou.Entry` | V2 ledger；Entry `metadata.legacy` 中 `system/table/id` | 唯一 target 或 unresolved / conflict；可见性与失踪 target 的处理 |
| `word_pronunciation / source_id` | `guantou.Recording` | V2 ledger；Recording `metadata.legacy`；ledger metadata 中 `entry_id` / 关联键 | 单录音映射及关联 Entry；不可从 parent word ID 猜 Recording |
| `auth_user / source_id` | `auth.User` | 现有账号导入台账 | 仅内部身份核验，公开 resolver 不输出手机号、邮箱、权限或登录凭证 |
| 词单、文章、评论、试卷、商品、订单、消息、字符 | 未建立通用映射 | 不在当前活动 importer 的公开内容迁移范围 | 明确 unsupported / not-migrated，不滥用 word 映射 |

建议 #432 消费结构包含 `source_system`、`source_table`、字符串 `source_id`、`target_model`、`targets`、`status`、`reason` 与核验时间。此处是**需求建议**，不是已批准 contract。需支持唯一、无映射、一对多、冲突、hidden / visibility mismatch、target missing，并与 #431 一致；语言学歧义不自动合并。

建议承接规则：仅有一个当前可见且有效目标时直达；零个目标不猜测；多个目标停止自动跳转。公开返回应将 hidden 和 missing 合并成不可公开访问；内部审计保留更细原因供 #434 / #433 使用。待 #432 稳定后才能确认 resolver、导出格式和 redirect 实现，不以此文绕过它的评审。

## 6. 真实入口抽样与验证边界

| 样本 | 来源与观察 | 预期映射 / 判定 |
| --- | --- | --- |
| `https://hinghwa.cn/` | Web README / 路由首页；2026-10-03 Web 抓取超时 | S → H fallback；不能证明当前页面内容 |
| `https://m.hinghwa.cn/pages/index` | Web `App.vue` 硬编码跳转 | S → H；本次抓取工具无法访问，未判定生产失效 |
| `http://hinghwa.cn/articles/175` | Web Footer“联系我们”的真实固定链接；抓取到 HTTPS 的 SPA JavaScript 提示 | 历史文章未接入说明；**未验证文章正文可读或已迁移** |
| `https://hinghwa.cn/search?desktop=1` | 旧 Web README 的真实示例 | Q；移除设备开关；示例无关键词 |
| `/pages/search?index=<scope>&keywords=<text>` | 旧搜索页实际分享生成器 | Q + 明确范围变化；本次无真实用户分享日志 |
| `/pages/words/details?id=<word ID>` ↔ `https://hinghwa.cn/words/<word ID>` | 旧词条详情实际分享 / 复制生成器 | `word_word` → E；真实旧 ID 的目标核对待 production-copy rehearsal |

旧路由测试中的 `123` / `555` / `777` 只用于说明参数类型，不作为真实生产对象样本。本次真实固定 URL 样本与动态生成器证据分开记录，未伪造词条生产 ID 或成功迁移结果。没有访问生产库、真实账户或私人分享记录。

## 7. Demo 与 #429 验收

1. 在 CSV 搜索 `/words/:id` 和 `/pages/words/pronunciations`：分别确认 `word_word` 映射与词条关联录音行为。
2. 搜索 `articles`、`lists`、`quizzes`、`products`：每类均可看到未接入说明和 fallback。
3. 打开原型的“旧链接”状态，检查无映射时主动搜索和回站；这只是设计示意，不是真 resolver 验证。
4. 对照 #432 确认 source system / table / target_model 的差别；未稳定的 contract 明确留作依赖。

| 验收项 | 证据 |
| --- | --- |
| 源码可发现的全部公开主类型 | CSV 逐项来源 + 第 3 节主类型表；受保护类型也列明权限 |
| 真实 URL 抽样 | 第 6 节真实硬编码 / README 示例；动态分享生成器另列 |
| 不可映射项有 fallback | CSV 每项 fallback + 第 2、4 节退化规则 |
| 对齐 CM-03 | 第 5 节 source key、目标模型、状态与未支持类型 |

实际检查（2026-10-03）：逐条核对 CSV 来源文件 / 行号和原始字符串；确认 48 + 57 个登记入口均覆盖、291 条来源记录、183 个 `(platform, legacy_route)` 去重项及 250 个 `(platform, source_pattern)` 去重项，文档本地链接存在，答题搜索不误归类为词条搜索，账户参数入口与异常分享 / 导航别名有 fallback。独立 agent 审查发现的手机号登记状态、遗漏积分入口、账户参数意图和原型返回问题均已修正。审查建议补充的列名计数口径、导入器完整路径及 CSV 无 BOM 编码均已落实。

未验证：生产访问量排序、真实旧词 / 录音 ID 在新库的存在性与可见性、登录主体映射、微信真机、旧域名 rewrite 与 redirect 上线。它们在 #432 / #433 及后续实现与发布 Gate 中核对；本 Leaf 完成的是可 review 的映射设计。
