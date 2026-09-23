# TDesign UI migration tracker

> 本页保留 2026 年 V2 切换前的控件迁移证据。表中 Can/Nameplate 等页面已在
> Entry/Recording V2 切换后退役，不再表示当前页面清单或待办；当前前端边界见
> [`FRONTEND_GUIDE.md`](FRONTEND_GUIDE.md)。

通用控件迁移遵循 [ADR-0005](adr/0005-tdesign-ui-foundation.md) 和 [`frontend/AGENTS.md`](../frontend/AGENTS.md)。状态含义：`done` 已完成；`partial` 已使用部分 TDesign 但仍有遗留控件；`issue` 已延期并由独立 issue 跟踪；`queued` 尚未开始。

本轮 H5 视觉基线保存在 [`docs/assets/tdesign-migration/`](assets/tdesign-migration/)（390×844，含浅色、暗色、旧表单兼容与 404 空态）。

V2 全站聚合验收由 [#346](https://github.com/e-dialect/xiangsheng-box/issues/346) 跟踪；33 个当前注册页面、核心界面明暗/身份组合、四种数据状态以及微信真机待验项见 [`V2_VISUAL_REGRESSION.md`](V2_VISUAL_REGRESSION.md)。

共享 `BaseButton` 的 ghost / outline 按压态由 [#381](https://github.com/e-dialect/xiangsheng-box/issues/381) 固定为当前强调色边界与文字、强调浅色背景；避免 TDesign 固定深色 active token 在暗色主题中形成伪禁用，同时不改变 primary、danger、disabled 或 loading 状态。

[#410](https://github.com/e-dialect/xiangsheng-box/issues/410) 将 `soft` / `fog` 的文字、背景和描边重新绑定到项目语义 Token：浅底按钮使用语义正文色，雾面按钮使用次级正文色，避免支持主题下前景与背景同色或对比度不足；页面不再为主题按钮单独补色。

| 页面/共享区域 | 状态 | 后续工作或 Issue |
| --- | --- | --- |
| `components/BaseButton/BaseForm/BaseField/BaseLoading` | done | 项目级原语；BaseField 在 BaseForm 内转发真实表单关系，独立使用时提供无 DOM 的安全关系，页面切换不触发 FormItem 卸载错误 |
| `components/EmptyState` | done | 所有现有消费者自动迁移；[#385](https://github.com/e-dialect/xiangsheng-box/issues/385) 移除 192rpx 装饰性信息图标，统一为标题、说明、动作的内容优先节奏 |
| `components/PageShell` / `components/AppShell` / `components/home/HomeTabBar` | done | 已接入按钮原语与反馈 Host；[#340](https://github.com/e-dialect/xiangsheng-box/issues/340) 收敛主入口标题区、普通页面顶栏与底部导航层级，底栏始终只有一个选中态，“录”在未选中时保留独立行动入口语义；PageShell 返回动作也使用具名的项目圆形按钮，不再局部仿制 |
| `components/PlatformScroll` | done | PageShell、AppShell 与首页录音流共用垂直滚动语义；H5 条件编译为原生可滚动 `view`，规避页面重新激活时 `scroll-view` 访问已卸载节点，小程序继续编译为原生 `scroll-view`；三种 shell 变体在组件内持有各端容器几何，避免跨组件 scoped 样式失效 |
| `components/CommentThread` | done | 表单、按钮、加载与空态使用项目原语 |
| `pages/error/not-found` | done | [#362](https://github.com/e-dialect/xiangsheng-box/issues/362)：低饱和 404 说明、脱敏的长路径回显与唯一首页恢复动作 |
| `pages/users/settings/username` | done | [#344](https://github.com/e-dialect/xiangsheng-box/issues/344) / [PR #348](https://github.com/e-dialect/xiangsheng-box/pull/348)：共享账户设置面板与单字段表单 |
| `pages/users/settings/nickname` | done | [#344](https://github.com/e-dialect/xiangsheng-box/issues/344) / [PR #348](https://github.com/e-dialect/xiangsheng-box/pull/348)：共享账户设置面板与单字段表单 |
| `pages/users/settings/telephone` | done | [#344](https://github.com/e-dialect/xiangsheng-box/issues/344) / [PR #348](https://github.com/e-dialect/xiangsheng-box/pull/348)：共享账户设置面板与单字段表单 |
| `pages/mails/send` | done | [#195](https://github.com/e-dialect/xiangsheng-box/issues/195) / [PR #216](https://github.com/e-dialect/xiangsheng-box/pull/216)：标准表单、字段错误与 payload 回归测试；[#356](https://github.com/e-dialect/xiangsheng-box/issues/356) / [#398](https://github.com/e-dialect/xiangsheng-box/issues/398)：按用户任务重整收件人发现、身份确认与发送反馈 |
| `pages/login/login` | done | [#238](https://github.com/e-dialect/xiangsheng-box/issues/238) / [PR #309](https://github.com/e-dialect/xiangsheng-box/pull/309)（源自关闭的 [#209](https://github.com/e-dialect/xiangsheng-box/pull/209)）：BaseField/BaseButton、双登录模式独立校验、字段错误与提交状态；[#388](https://github.com/e-dialect/xiangsheng-box/issues/388) 将查词、找回密码与注册入口收敛为 TDesign 文字按钮，扩大触控热区并保留登录恢复与统一路由转场 |
| `pages/nameplates/create` | done | [#237](https://github.com/e-dialect/xiangsheng-box/issues/237)：BaseForm/BaseField/BaseButton、与装罐页一致的 Cascader/Picker、联合校验、加载重试与防重复提交；H5 浅暗主题已验收，小程序构建通过，真机验收待补 |
| `pages/users/settings/information` | done | [#225](https://github.com/e-dialect/xiangsheng-box/issues/225) / [#344](https://github.com/e-dialect/xiangsheng-box/issues/344)：头像开放能力、无头像回退、日期与方言 Picker；[#386](https://github.com/e-dialect/xiangsheng-box/issues/386) 将用户名、昵称、安全字段与选择器入口统一为带箭头和点击反馈的 TDesign Cell |
| `pages/users/settings/password` | done | [#229](https://github.com/e-dialect/xiangsheng-box/issues/229) / [#344](https://github.com/e-dialect/xiangsheng-box/issues/344)：密码显示、表单提交与账户安全视觉层级 |
| `pages/users/settings/email` | done | [#227](https://github.com/e-dialect/xiangsheng-box/issues/227) / [#344](https://github.com/e-dialect/xiangsheng-box/issues/344)：验证码、邮箱绑定流程与账户安全视觉层级 |
| `pages/login/register` | done | [#228](https://github.com/e-dialect/xiangsheng-box/issues/228) / [PR #309](https://github.com/e-dialect/xiangsheng-box/pull/309)（源自关闭的 [#209](https://github.com/e-dialect/xiangsheng-box/pull/209)）：邮箱注册迁移到 BaseField/BaseButton，保留既有 API 契约并补字段错误与提交状态；[#389](https://github.com/e-dialect/xiangsheng-box/issues/389) 统一第二步返回修改账号的文字按钮语义与草稿保留 |
| `pages/login/register/wechat` | done | [#230](https://github.com/e-dialect/xiangsheng-box/issues/230) / [PR #308](https://github.com/e-dialect/xiangsheng-box/pull/308)（源自关闭的 [#209](https://github.com/e-dialect/xiangsheng-box/pull/209)）：BaseField/BaseButton、昵称确认、行内错误及可等待的微信授权注册 |
| `pages/login/forget` | done | [#226](https://github.com/e-dialect/xiangsheng-box/issues/226) / [PR #308](https://github.com/e-dialect/xiangsheng-box/pull/308)（源自关闭的 [#209](https://github.com/e-dialect/xiangsheng-box/pull/209)）：分步找回、字段校验、提交状态与错误映射；[#389](https://github.com/e-dialect/xiangsheng-box/issues/389) 补齐第二步返回修改用户名动作并清理敏感重置草稿；不引入演示验证码 |
| `pages/cans/create` | done | [#232](https://github.com/e-dialect/xiangsheng-box/issues/232) / [PR #282](https://github.com/e-dialect/xiangsheng-box/pull/282)：BaseForm / BaseField、按钮、加载、空态与共享反馈；保留方言级联、枚举 Picker、录音及草稿业务，见下方验收记录 |
| `pages/pronunciations/create` | done | [#234](https://github.com/e-dialect/xiangsheng-box/issues/234)：PageShell + BaseForm/BaseField/BaseButton、统一加载/重试/反馈；保留写法 Picker、方言级联、联合校验、字段错误定位与成功返回 |
| `pages/shelves/index` | issue | [#231](https://github.com/e-dialect/xiangsheng-box/issues/231)：创建表单与列表状态 |
| `pages/shelves/details` | issue | [#235](https://github.com/e-dialect/xiangsheng-box/issues/235)：编辑、双搜索和成员管理 |
| `pages/search` | done | Entry-first 搜索使用 BaseField/BaseButton 与 TDesign 折叠、级联和选择器；[#342](https://github.com/e-dialect/xiangsheng-box/issues/342) 将主路径收敛为“输入 → 状态/结果摘要 → 高级筛选 → 独立词条”，同形异义不合并，失败、空结果与能力维护态都有明确下一步 |
| `pages/entries/details` | done | [#342](https://github.com/e-dialect/xiangsheng-box/issues/342) 按“写法与释义 → 地区与读音 → 录音 → 证据与状态 → 参与操作”呈现，保留地区确认、收藏与接龙录音契约 |
| `pages/users/onboarding` | done | [#233](https://github.com/e-dialect/xiangsheng-box/issues/233) / [PR #310](https://github.com/e-dialect/xiangsheng-box/pull/310)（源自关闭的 [#209](https://github.com/e-dialect/xiangsheng-box/pull/209)）：BaseField/BaseButton、方言树加载重试与真实乡音样本；保留登录中断恢复 |
| `pages/cans/drafts` | done | [#195](https://github.com/e-dialect/xiangsheng-box/issues/195) / [PR #216](https://github.com/e-dialect/xiangsheng-box/pull/216)：加载、空态、错误、继续编辑与删除反馈 |
| `pages/cans/index` / `library` | queued | 每页独立 PR |
| `pages/cans/details` / `comments` | done | 普通控件已收敛；分享开放能力及低频 Cell/Textarea 直接使用 TDesign |
| `pages/nameplates/details` / `comments` | done | 普通按钮与加载已收敛；低频 Cell 直接使用 TDesign |
| `pages/posts/compose` | done | [#195](https://github.com/e-dialect/xiangsheng-box/issues/195) / [PR #216](https://github.com/e-dialect/xiangsheng-box/pull/216)：来源锁定、发布状态、字段错误与成功跳转 |
| `pages/posts/details` | queued | 独立 PR |
| `pages/flavors/index` / `details` | queued | 搜索、列表与详情操作 |
| `pages/packages/index` / `details` | queued | 搜索、加载与详情操作 |
| `pages/circles/index` / `details` | done | [#355](https://github.com/e-dialect/xiangsheng-box/issues/355)：地区社群说明、单列搜索、低干扰加入/查看动作及圈内录音加载、空、局部失败和正常态；录音失败不再抹掉已加载的圈子资料 |
| `pages/discovery/index` | queued | 操作按钮与加载状态 |
| `pages/users/me` | done | [#344](https://github.com/e-dialect/xiangsheng-box/issues/344) / [PR #348](https://github.com/e-dialect/xiangsheng-box/pull/348)：完整账户中心与游客身份入口；[#373](https://github.com/e-dialect/xiangsheng-box/issues/373) 消除 TDesign `.page` 品牌色覆盖；[#376](https://github.com/e-dialect/xiangsheng-box/issues/376) 补齐无头像文字回退；[#393](https://github.com/e-dialect/xiangsheng-box/issues/393) 让作品面板成为唯一贡献入口，并把收藏与关注收为紧凑档案导航；[#394](https://github.com/e-dialect/xiangsheng-box/issues/394) 把游客听、查、主题入口统一为具备完整触区与键盘语义的 TDesign Cell |
| `pages/users/details` | done | [#355](https://github.com/e-dialect/xiangsheng-box/issues/355)：他人主页使用统一档案面、无头像回退、主次关注/私信操作和具备 tab 语义的公开贡献状态 |
| `pages/curation/index` / `apply` | done | [#360](https://github.com/e-dialect/xiangsheng-box/issues/360)：整理权限申请、授权公开记录与审核待办统一为范围 → 资料 → 判断 → 依据的可信工作流 |
| `pages/users/contributions` / `bookmarks` | done | [#361](https://github.com/e-dialect/xiangsheng-box/issues/361)：贡献概览、地区足迹、最近参与与私人词条书签统一为可浏览的个人资料档案 |
| `pages/users/recommend-follow` | done | [#344](https://github.com/e-dialect/xiangsheng-box/issues/344) / [PR #348](https://github.com/e-dialect/xiangsheng-box/pull/348)：延续身份旅程，并保留统一加载、空态、重试及关注结果反馈 |
| `pages/users/theme-center` | done | 总览 THEME_CENTER.md；[#369](https://github.com/e-dialect/xiangsheng-box/issues/369) 将路由入口拆为可独立验证的搜索、目录、最近、收藏、搭配与弹层视图，边界见 [THEME_CENTER_VIEW_ARCHITECTURE.md](THEME_CENTER_VIEW_ARCHITECTURE.md)；[#375](https://github.com/e-dialect/xiangsheng-box/issues/375) 将次要的“最近使用”无记录提示收为 opt-in 紧凑状态，保留共享完整空态与曝光语义；[#387](https://github.com/e-dialect/xiangsheng-box/issues/387) 收敛正文与弹层重复的筛选入口，并按全局主题、局部装扮、搜索上下文只展示有效维度；[#392](https://github.com/e-dialect/xiangsheng-box/issues/392) 将筛选标题、当前摘要与箭头收为同一整行 TDesign Cell 触区。三期不在本页做投稿社区。跳转 NAV |
| `pages/users/theme-dress` | done | 单组局部装扮：免费/会员/活动/创作者权限、待上线占位；不覆盖其它分组 |
| `pages/users/theme-acquire` | done | 装扮获取聚合：会员、活动、创作任务与方言主题福利；[#391](https://github.com/e-dialect/xiangsheng-box/issues/391) 让游客保留本地已核验进度且不请求登录态贡献接口 |
| `pages/users/theme-member` | done | 开通会员，权益 H5/小程序同步 |
| `pages/users/theme-event` | done | 活动领取与已绝版提示 |
| `pages/mails/index` / `details` | done | [#356](https://github.com/e-dialect/xiangsheng-box/issues/356)：消息概览与未读层级、加载/空白/失败状态、关联内容与回复闭环；[#358](https://github.com/e-dialect/xiangsheng-box/issues/358)：用项目加载原语替换未解析的隐式分页组件 |

## 站内消息体验 #356 / #398

- 收件箱、详情和发送页统一使用“消息”术语。收件箱先说明当前未读情况，再提供“全部 / 未读”筛选；列表以发送者、时间、标题、正文摘要和下一步为固定扫读顺序，缺失头像显示稳定的文字回退。
- 首屏加载、加载失败、筛选后空白和分页失败分别提供可辨认状态。批量已读和单条已读失败不会误改本地状态；打开单条消息时，即使标记已读失败也不阻断原本的内容跳转。
- 详情页按发送者、状态与时间、标题、正文排列；有关联对象时给出内容类型对应的动作，来自普通用户的消息可直接回复并自动带入收件人与原标题，系统消息不显示回复动作。发送页关闭根节点属性透传，避免 `title` 查询参数覆盖页面顶栏。
- #398 删除直接输入收件人编号和管理员 `-1` 的交互。发送页改为带放大镜的用户搜索，可按昵称、用户名或精确编号查找；结果与已选卡同时展示头像、昵称、用户名、编号和方言点，管理员作为独立服务入口。从同乡主页或回复进入时解析真实身份并允许重新选择，ID 只保留为兼容通知 API 的内部提交值。
- 用户搜索仅对登录用户开放，限制结果数量，排除自己、停用账户与管理员账户，不按邮箱或手机号等私密字段匹配；覆盖搜索中、无结果、失败、选择、重选、路由预选与管理员入口。
- 回归覆盖收件箱筛选与已读状态、已读失败、详情重试、关联内容、回复预填、系统消息限制和收件人搜索/确认；H5 以 390×844 浅暗主题及跨视口矩阵检查三页层级，并继续执行完整 lint、单元测试、后端测试、H5 与微信小程序构建。
- #358 使用 `BaseLoading` 与页面内弱提示承载加载中、可继续加载和无更多三态，统一中文文案与既有 Token；不再依赖 H5 无法解析的隐式 `uni-load-more`，也不额外引入旧组件的 Sass 构建告警。

## 账户身份旅程（#344 / PR #348）

- 游客“我”、登录、注册、找回、新用户称呼与主方言设置使用同一套深松绿身份区与温润表单面；注册的四段进度对应真实提交步骤，不制造装饰性假进度。
- 推荐关注页延续身份旅程，但明确标成“身份设置已完成”，不把可跳过的关注推荐伪装成第五个必填步骤。主方言、关注地区与真实贡献者保留原服务契约。
- 用户名、昵称、邮箱、密码、手机号共用账户设置页级面板；编辑资料页、推荐作者和账户首页为空头像补可辨识的文字回退，不改变头像上传、生日、方言选择、头像框或编辑资料入口。
- 390×844 H5 截图：推荐关注[浅色](assets/ui-v2/issue-344/recommend-follow-after-light-390x844.png) / [暗色](assets/ui-v2/issue-344/recommend-follow-after-dark-390x844.png)，账户安全[浅色](assets/ui-v2/issue-344/account-settings-after-light-390x844.png) / [暗色](assets/ui-v2/issue-344/account-settings-after-dark-390x844.png)，[编辑资料](assets/ui-v2/issue-344/profile-settings-after-light-390x844.png)。
- 自动化验证覆盖 lint、完整单元测试、H5/微信小程序构建，以及账户设置和方言引导 H5 E2E。运行期 H5 原生 API 噪声、SQLite 审计锁争用与构建弃用告警分别由 #350、#351、#352 跟踪；主题模块 chunk 告警沿用 #328。

## 装罐页 #232 验收记录

- 基于 #216 已完成的方言级联与录音布局迁移，继续使用一次加载的方言树、默认/最近方言快捷入口及三个枚举 Picker，不增加惰性请求。
- 普通话概念与方言点通过 BaseForm 校验；音频可用性仍由页面业务校验。家乡话写法、说明、读音、来源及备注继续选填，字段长度和提交 payload 保持原样。补录模式继续锁定义项并调用原有提交服务。
- BaseField 支持自定义控件插槽和完成状态图标；BaseButton 显式传递录音操作图标，兼容小程序编译。AudioCapture 仅替换按钮与反馈，保留录音器、文件选择和播放适配。
- 草稿基线测试先于迁移建立；覆盖临时音频持久化、失效音频、账号隔离、游客登录归属、登录前保存失败、401 返回上下文、提交失败保留和成功后清理。异步校验期间也阻止重复提交。
- 自动化验证：前端 lint、完整单元测试、H5 与微信小程序构建；新增浏览器测试使用模拟 API 和浏览器测试音源，覆盖真实 H5 控件、麦克风拒绝后重试、IndexedDB 恢复/缺失音频、游客登录拦截、提交失败与成功清理。
- 浅暗主题在 390×844 视口验收；长图仅展开页面滚动容器以展示完整内容：[浅色](assets/tdesign-migration/can-create-light-390x844.png)、[暗色](assets/tdesign-migration/can-create-dark-390x844.png)。
- PR 展示使用提交者提供的三张截图：[草稿恢复弹窗](assets/tdesign-migration/issue-232/draft-restore.png)、[补充表单](assets/tdesign-migration/issue-232/optional-fields.png)、[录音完成状态](assets/tdesign-migration/issue-232/recording-ready.png)。
- 微信录音回调与临时文件恢复已做模拟回归，并通过小程序构建；本次未连接微信真机，系统授权弹窗、实际设备录音与重启后的文件恢复仍需真机验收。

浏览器复现：启动 H5 预览后，设置 `E2E_BASE_URL` 为预览地址，运行 `npx playwright test tests/e2e/can-create-form.spec.js --workers=1`。可选设置 `E2E_SCREENSHOT_DIR=../docs/assets/tdesign-migration` 保存长图。

## 发表立论页（#237）

- 表单使用 BaseForm/BaseField/BaseButton；BaseField 支持插槽承载方言 Cell。方言手动导入 TDesign Cascader，来源类型使用 Picker/PickerItem，与装罐页使用相同的组件、标题和选项布局。PageShell 使用页面滚动，让长表单校验能定位到错误字段。
- 方言使用与装罐页共享的方言树构建和路径查找逻辑：分级标签、名称/编码/路径搜索、完整路径与选中图标、默认方言点及按账号隔离的最近三项快捷入口（共用装罐页历史）。参考铭牌的方言默认选中但可覆盖，没有匹配时沿用列表首项；空列表仍允许不传 `dialect_id`。
- 资料来源类型与装罐页共用八项选项定义，统一标题、名称和顺序；Cell 以标题展示当前值，Picker 取消不改变原值。
- 写法和实际读音至少填写一项（纯空白不算），联合错误由 BaseForm 显示在两个字段下方；修改任一字段同时清除两处旧错误。仅在 `validate()` 返回 `true` 时提交。
- 保留 `nameplate_create` 登录恢复上下文、参考铭牌加载、`createNameplate` 调用及成功后的 replace 跳转。写法、读音和释义清理首尾空白；来源字段只过滤空白项，保留非空值的原文。`creator` 的证据等级继续为 1，其余七种来源为 2。
- 加载中使用 BaseLoading，加载失败使用 EmptyState 重试；提交失败保留输入和错误提示。通用错误由请求层通过 feedback service 提示，成功使用 `notifySuccess`。异步校验、请求和成功跳转阶段均防止重复提交。

回归入口：`frontend/tests/unit/NameplateCreate.test.js`（24 项）与 `frontend/tests/e2e/nameplate-create.spec.js`（7 项）。浏览器测试使用隔离接口响应，覆盖 390×844 浅暗主题、联合错误与定位、方言层级浏览/关闭/搜索/默认及最近快捷选择、来源 Picker 的取消/重新打开/确认、来源过滤与 payload、登录拦截、加载失败重试、提交失败重试和重复点击，不写入真实业务数据。

390×844 H5 截图：首屏 [浅色](assets/tdesign-migration/nameplate-create-light-390x844.png) / [暗色](assets/tdesign-migration/nameplate-create-dark-390x844.png)，方言 Cascader [浅色](assets/tdesign-migration/nameplate-create-picker-light-390x844.png) / [暗色](assets/tdesign-migration/nameplate-create-picker-dark-390x844.png)，来源 Picker [浅色](assets/tdesign-migration/nameplate-create-source-light-390x844.png) / [暗色](assets/tdesign-migration/nameplate-create-source-dark-390x844.png)，长表单底部 [浅色](assets/tdesign-migration/nameplate-create-footer-light-390x844.png) / [暗色](assets/tdesign-migration/nameplate-create-footer-dark-390x844.png)。

在已启动的 H5 服务上运行 `npm run test:e2e:h5 -- tests/e2e/nameplate-create.spec.js`，非默认端口通过 `E2E_BASE_URL` 指定；设置 `UPDATE_MIGRATION_SCREENSHOTS=1` 可刷新文档截图。已通过 lint、全量单元测试、H5 与微信小程序构建，并检查小程序产物显式注册 Cascader、Picker/PickerItem 组件且页面没有原生 Picker。当前环境未进行微信开发者工具/真机浅暗主题交互验收，构建结果不替代这一步。

## 添加读音页（#234）

- 义项继续由路由锁定；唯一关联写法自动选中，多个写法不自动选首项。重新加载时保留仍有效的选择，清除不再关联的写法。
- 方言保留可检索的层级级联、默认方言与最近使用入口。读音类型与更多语言学信息的显隐方式不变。
- `validatePronunciationDraft` 仍是联合校验的来源：IPA、写法、方言必填；变调前后形式成对填写；填写变调环境时必须同时具备两种形式。`sandhi_info` 错误映射到 `sandhi_environment` 表单项。
- 客户端和服务端字段错误均交给 BaseForm 展示；先展开相关折叠区，再校验并滚动定位。PageShell 使用页面滚动，让 TDesign 的错误定位在长表单中生效。
- 提交继续清理首尾空白、转换数字 ID，保留 API 与 payload；成功时返回上一页，无历史栈则返回锁定义项详情。请求失败保留输入，不重复弹出字段错误提示。

回归入口：`frontend/tests/unit/PronunciationCreate.test.js` 与 `frontend/tests/e2e/pronunciation-create.spec.js`。浏览器用例使用隔离的接口响应，不写入真实业务数据，覆盖浅暗主题、写法/方言选择、变调联合校验、服务端错误、选项加载失败/重试与成功返回。

390×844 H5 截图：[浅色](assets/tdesign-migration/pronunciation-create-light-390x844.png)、[暗色](assets/tdesign-migration/pronunciation-create-dark-390x844.png)、[变调校验](assets/tdesign-migration/pronunciation-create-sandhi-error-390x844.png)。

在已启动的 H5 服务上运行 `yarn test:e2e:h5 tests/e2e/pronunciation-create.spec.js`；非默认端口通过 `E2E_BASE_URL` 指定。需要刷新文档截图时设置 `UPDATE_MIGRATION_SCREENSHOTS=1`，普通测试只生成测试附件。微信小程序需通过 `yarn build:mp-weixin`；构建不替代开发者工具/真机交互验收。

## 整理申请与审核工作台（#360）

- 申请页先解释“权限有范围、授权有期限、判断留依据”，再把表单拆为选择范围与说明核对能力两步；待审、历史和公开授权记录分别呈现，不再混成相同卡片。
- 首次加载失败会显示可重试错误态，不再把未知数据误呈现为空记录和可提交表单。待审申请说明后续流程，撤回前通过共享确认层明确告知会进入历史且重新参与需要再次申请。
- 工作台在首屏列出当前授权范围；每项待办先展示资料类型、地区和摘要，再由整理员主动选择处理结果。通过、保留争议、退回默认均不预选，选中后才展开影响说明、判断依据与唯一确认操作。
- 页面只使用项目主题 Token、BaseButton/BaseField/BaseForm/BaseLoading/EmptyState 与 DialectSelector/DialectLabel；不改变权限、API、审核动作、payload 或数据可见性语义。
- 回归覆盖申请 payload、失败态、历史理由、撤回确认、审核结果中立初态、判断 payload 与失败态；H5 以 390×844 浅色/暗色检查申请、待审、工作台、展开判断、空态与错误态，并检查浏览器控制台。H5 与微信小程序构建作为合入门禁。

## 贡献履历与词条收藏（#361）

- 贡献履历先说明可追溯、不排名的用途，再以一条紧凑概览辅助找回录音、补证、修订和地区足迹；地区与最近活动改用不同的扫读结构，长标题不截断，空档案给出录音入口。
- 词条收藏补齐私人书签说明和收藏数量；每张卡按状态、标题、大意、地区/录音/依据、动作排列，长词条不再被右侧按钮挤成窄列。“查看词条”是卡片主动作，“移出收藏”为次要操作。
- 两页均使用 BaseLoading 与 EmptyState 区分加载、失败和真实空白。移出收藏增加逐项 busy 状态；请求失败时保留词条并给出反馈，不再产生未处理拒绝。
- 页面只使用项目 Token 和既有项目原语，不增加积分、排名、权威等级、收藏类型、接口或后端统计。回归覆盖正常/失败/空白、长标题、详情导航、移出成功与失败；H5 以 390×844 检查浅色/暗色和浏览器控制台，H5/微信小程序构建作为合入门禁。

## 未知路由恢复（#362）

- 404 页延续 PageShell 与项目 Token，用低饱和状态卡解释“链接打不开”而不是制造错误警报；页面只保留一个“回到首页”主动作，避免用户继续在无效路径里选择。
- H5 尽可能从导航历史恢复刚才访问的 pathname；显式 `path` / `from` 参数可供其它平台使用。展示前会解码并剥离 query/hash，避免把 token 等敏感参数回显到页面。
- 长路径允许逐字符换行；直接访问兜底页时不伪造来源路径。单测覆盖脱敏与唯一可访问动作，H5 回归从真实未知长路径进入并验证返回首页。

## 未知 H5 路由门禁（#363）

- UniApp 原有 `App.onLaunch` 兜底晚于 Vue Router 的首次解析，真实未知 URL 会先产生 `No match found` warning。H5 构建现在通过后置 Vite 插件，在路由实例创建前向 UniApp 生成的 `__uniRoutes` 追加唯一 catch-all。
- catch-all 只把 `to.path` 作为 `path` query 传给 #362 页面，不携带原 URL 的 query/hash；已注册路由仍优先匹配。插件按 `UNI_PLATFORM=h5` 和 UniApp `__uniRoutes` 生成锚点双重限域，mp-weixin 不注入。
- 独立单测固定生成代码的锚点和平台边界；独立 H5 E2E 从真实未知长 URL 进入，要求脱敏路径、恢复动作以及 console warning/error、pageerror 全部通过。

## 页面级加载反馈（#365）

- 已自行呈现骨架、`BaseLoading` 或局部加载按钮的 V2 页面读取由服务层显式传递 `loading: false`，不再叠加黑色全局 `uni.showLoading`；涵盖词条/录音、方言/圈子、消息与推荐关注读取。
- 旧 `utils/request` 的布尔 `noPrompt` 参数保持兼容，仅新增可选 options 透传。创建、提交、上传、关注、收藏和审核等用户动作继续保留全局等待语义。
- #359 仍负责并发 loading 的引用计数和 toast 竞态；本项只确定页面级与全局反馈的职责边界。单元回归分别锁定读取不显示全局 loading、动作不被静默降级，并由 #346 聚合矩阵复核 390×844 浅暗主题和浏览器 console。

## H5 横屏与宽屏页面壳（#370）

- 390×844 的窄屏竖向节奏保持不变；844×390 短横屏压缩顶部与底部导航，把“听”页引导和完整状态卡留在首屏，同时保持内部滚动可达。
- 960px 以上窗口将沉浸首页、AppShell、PageShell 与固定底栏约束到居中画布，内容区进一步控制阅读宽度，避免移动端结构在桌面机械铺满。
- 布局使用项目主题 Token 与 H5 媒体查询，不改变路由、数据、权限或交互语义。回归矩阵覆盖 390×844、844×390、768×1024、1440×900 的三类页面壳；微信小程序仍以构建与真机安全区检查为准。

## 主题装扮与获取二级旅程（#371）

- 局部装扮、装扮获取、会员权益与限定活动共用 `ThemeJourneyIntro`：首屏按“当前场景—用户目标—真实状态”组织，不再让四页各自复制一张说明白卡。
- 装扮目录把预览、名称、权限、说明和操作按扫读顺序排列；未上架遮罩固定横向展示，长文案不会把“敬请期待”挤成逐字竖排。已应用项使用主题边界强调，但不改变收藏、分享、预览和应用行为。
- 获取页把会员、活动、创作任务和日常参与拆成不同资格路径；会员页收敛重复说明，活动页显式区分进行中、已拥有、已结束和无效链接，所有资格、碎片、同步和领取语义保持原样。
- #346 的 390×844 矩阵新增四页暗色样本、活动结束态和无效入口，并检查横向溢出、未上架标签尺寸以及浏览器 console warning/error/pageerror；H5 与微信小程序构建仍是合入门禁。

## 主题中心搜索层级（#374）

- 主题中心移除 PageShell 顶栏中与正文重复的“搜索”动作；页面标题只负责定位，正文搜索字段负责说明对象、承载输入、键盘确认与提交。
- 搜索服务、查询持久化、热门词、结果退出和返回拦截契约保持不变；不为同一 `submitThemeSearch` 保留两个同名主按钮。
- 回归同时锁定路由入口没有顶栏搜索 action、Discovery View 仍具备键盘确认与按钮提交，并以 390×844 浅暗主题和浏览器控制台复核实际页面。

## 主题中心筛选层级（#387）

- 顶部“筛选”按钮与摘要是目录筛选的唯一可见入口；全局主题和局部装扮正文不再重复渲染同义分类、地域、组件或排序横条。
- 筛选弹层按当前上下文显示有效维度：全局主题不显示局部装扮组件，局部装扮不显示全局风格和地域，聚合搜索保留两类维度。
- 摘要只回显当前上下文真正参与结果计算的条件；隐藏的另一标签页条件可以保留，但不得造成空态或摘要误导。

## Completion

所有 `issue` 和 `queued` 页面完成后：确认仓库不再使用原生交互控件、`uni-ui` 表单或 `cu-*`，再删除 `legacy-form-compat.scss`、ColorUI 全局引入、无用 easycom 映射与 `@dcloudio/uni-ui` 依赖。

## Entry / Recording V2 核心路径（#320）

- 一级导航收敛为“听 / 查 / 录 / 我”；单字只作视觉标签，交互控件使用完整无障碍名称。
- [#341](https://github.com/e-dialect/xiangsheng-box/issues/341) 将“听”页收敛为连续的深色乡音舞台：正常卡片按“当前录音—词条—地区/读音证据—操作”排序，加载、空、错误与维护状态使用稳定骨架和明确下一步；骨架循环动效尊重 reduced-motion。
- “听”直接读取 Recording 资源并保留主要 Entry 关联，支持播放、进入词条、确认本地用法和发起地区对比接龙。
- “查”以 Entry 为结果单位；相同写法不会自动合并，专业筛选在同页逐层展开。
- “录”最低只要求音频、已知使用地区和用户自己的大意；写法、读音、已有词条、来源和授权说明均为可选补充。
- “我”保留完整账户设置；普通用户看到整理员申请说明，有授权的用户才看到管理与审核待办，客户端不嵌入 Django 后台。
- V2 浏览器主路径由 `tests/e2e/guest-flow.spec.js` 与 `tests/e2e/h5-smoke.spec.js` 覆盖。旧 Can 首页评论浮层失去宿主后不再执行浏览器用例，其组件级交互仍由 `tests/unit/CommentSheet.test.js` 覆盖，并在阶段 8 删除旧领域时一并清理。

### 搜索与词条详情层级（#342）

- 搜索页首屏不预设用户知道正字，以写法、意思或读音作为同等入口，并给出可直接发起查询的示例；高级条件保持原 API 字段与 `false` 精确值语义，清空筛选时保留当前关键词。
- 查询后先说明独立词条数量与“同字异义分别保留”，再提供高级筛选和结果卡；卡片明确区分状态、地区、录音与待补音，并补齐键盘进入语义。
- 词条详情把释义、写法和地区读音置于录音之前，把辨识说明、整理状态及证据计数置于录音之后；录音与收藏集中在末尾共建区，不再让状态与指标抢占首屏。
- `tests/e2e/search-entry-hierarchy.spec.js` 在 390×844 视口覆盖初始/结果/失败/空结果/能力维护态及详情五段顺序；`tests/unit/EntryDetailHierarchy.test.js` 与 `tests/unit/SearchPage.test.js` 固化页面层级和筛选契约。浅色、暗色 H5 已人工复核；微信小程序以构建验证为本轮自动化边界。

### 方言圈与他人主页（#355）

- 方言圈广场先解释地区社群用途，再提供移动端单列搜索和目录；卡片用弱化的查看/加入双动作替代重复实心按钮，并把方言、成员与公开录音拆成可扫描信息。
- 圈子详情只保留一个情境主动作：有录音时在列表标题补录，没有录音时由空态邀请录第一段。圈内录音独立维护加载和错误状态，局部请求失败仍保留圈子说明与成员关系。
- 他人主页以档案面聚合头像、方言和公开计数；空头像显示姓名首字，不再产生破图。公开贡献切换补齐 tab/selected/键盘语义，加载与失败统一使用 BaseLoading/EmptyState。
- `tests/e2e/circles-profile-states.spec.js` 在 390×844 覆盖圈子列表、详情和公开档案的加载、空、失败与正常路径；浅色/暗色 H5 已人工复核，业务与共享组件契约保持不变。

## 主题底栏可读性（#366）

- `HomeTabBar` 不再把沉浸式前景色写死在可能为浅色的装扮背景上。主题与底栏装扮现在共同提供背景、普通文字、激活色、激活色上的文字、强调文字和边界六项语义变量；缺少新变量的旧远端主题继续使用原沉浸式回退值。
- 赛博与节日主题的浅色底栏使用页面自适应色组；`tabbar-plain` 使用表面自适应色组。颜色均来自现有主题 token，浅暗模式会同步切换，不新增局部色值。
- 前端内置目录和 Django 主题目录保持同一契约；数据迁移 `themes.0010_seed_tab_bar_contrast` 会重新发布目录并提升版本，避免已部署数据库继续返回旧的单背景配置。
- 390×844 H5 已验证 `tabbar-plain` 浅色/暗色和浅底赛博主题；同时检查实际计算后的背景、普通文字、激活文字、激活字形和边界颜色。回归入口为 `themeSchema.test.js`、`ThemeCatalogDomain.test.js`、`HomeTabBar.test.js` 与 `ThemeApiTests.test_live_packs_ship_surface_recipes`。

## 2026-09-06：v2 功能回归

新增录音详情、草稿、集盒列表和目录页，使用 PageShell、BaseButton、BaseForm、BaseField、
BaseLoading、EmptyState 与显式导入的 TDesign Switch。收纳面板使用现有组件，不恢复旧表单控件。
主题预览更新为“听／查／录／我”并增加集盒预览。

实施依据：[已确认计划](plans/2026-09-06-v2-restoration.md)，实现见 [PR #408](https://github.com/e-dialect/xiangsheng-box/pull/408)；功能去向见
[回归记录](audits/2026-09-06-v1-feature-restoration.md)。浏览器测试为 `frontend/tests/e2e/restoration.spec.js`。

### 二次补缺：词条讨论与草稿生命周期

关联 #405、#407。新增共享 DiscussionThread，词条与录音详情共用 BaseForm/BaseField/BaseButton、加载与错误反馈；词条讨论为独立内容区。草稿箱用 BaseLoading 展示实际音频状态检查，录音页沿用原表单和保存反馈，增加编辑与离页保存。
