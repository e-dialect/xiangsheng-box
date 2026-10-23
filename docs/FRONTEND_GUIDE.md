# 前端开发指南

## 页面与导航

一级导航固定为“听 / 查 / 录 / 我”。页面路由和跳转统一通过
`src/services/navigation.js`，登录恢复只接受其白名单目标。不要恢复已退役的 cans、
nameplates、flavors、packages、shelves、posts 或 discovery 页面。

## 数据访问

- Entry、EntrySense、PronunciationVariant、Recording、关联、补证、收藏和整理接口：
  `src/services/entryRecording.js`。
- 方言树和方言圈：`src/services/guantou.js`。
- 词条来源、整理历史与范围缩小：`src/services/curationReview.js`；独立的来源/历史读取不依赖当前工作台授权摘要。
- 听页筛选和分页编排：`src/services/listenFeed.js`。
- 所有请求最终经过 `src/utils/httpClient.js`；页面中不要直接调用 `uni.request`。

公开资源路径使用 `/entries/`、`/recordings/`、`/recording-entry-links/` 等根路径。
Can/Nameplate/Flavor/Package 聚合搜索和客户端兼容层已经删除。

## 交互原则

- 录音流程先呈现必填的录音、使用地区和大意，专业写法与音标渐进展开。
- 所有地区录入、资料、关注和筛选复用 `DialectSelector`；允许停在任意父节点。
- 展示地区使用 `DialectLabel` 提供的自然名称或路径，不显示 `qualified_code`。
- 加载、空态、错误和确认统一复用基础组件与 `src/services/feedback.js`。
- “我”页保留完整账户能力；整理入口只在服务端返回有效授权时出现。
- 主题只改变视觉 token 和装饰，不改变内容名称、导航语义、权限或信息层级。

## 验证

修改核心流程至少运行 `yarn lint`、`yarn test:unit`、`yarn build`、
`yarn build:mp-weixin`。H5 E2E 应覆盖游客听与查、母语者录音、爱好者补证、学习者查词、
整理员工作台和账户中心。
