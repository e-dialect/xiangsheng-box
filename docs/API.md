# API 文档

乡声集盒当前只公开 Entry / Recording V2 领域接口。字段、方法和状态码以
[`api/v1/openapi.yaml`](api/v1/openapi.yaml) 为准；这里的 `v1` 是公开契约目录版本，
不代表已退役的 Can/Nameplate V1 领域。

## 权威顺序

1. [`api/v1/openapi.yaml`](api/v1/openapi.yaml)：公开路径和字段契约。
2. [`api/v1/README.md`](api/v1/README.md)：中文语义与典型流程。
3. [`ARCHITECTURE.md`](ARCHITECTURE.md)：运行时边界。
4. [`adr/0006-entry-sense-recording-domain.md`](adr/0006-entry-sense-recording-domain.md)：V2 领域决策。
5. [`adr/0007-retire-legacy-can-nameplate-runtime.md`](adr/0007-retire-legacy-can-nameplate-runtime.md)：旧运行时退役决策。

## 核心约定

- 业务资源直接挂在根路径并保留尾斜杠，如 `/entries/`、`/recordings/`。
- 写接口使用 `Authorization: Bearer <token>`；公开资料默认允许匿名读取。
- 列表统一返回 `{ count, next, previous, results }`。
- 同形不同读音或核心意义返回不同 Entry；Concept 关联不会自动合并词条。
- Recording 与 Entry 通过 `primary / mention / competing` 多对多关联。
- 地区默认精确匹配；只有 `dialect_scope=subtree` 才包含后代。
- Can、Nameplate、Flavor、Package、Pronunciation、Shelf、Post、Comment 旧领域路径已退役，
  旧数据库表仅用于历史归档和可追溯迁移。

## 维护检查

修改公开契约时同步更新 OpenAPI、中文说明和 ADR，并运行：

```bash
make api-contract-check
```

检查会同时确认 V2 serializer/route 与 OpenAPI 对齐，以及旧核心路由没有重新出现。

## 集盒与录音轻互动

- `GET/POST /collections/`：公开集盒列表／创建私有集盒；`mine=true` 读取自己的集盒，支持标准分页。
- `GET/PATCH/DELETE /collections/{id}/`：目录、盒签修改和删除；只有所有者可写。
- `POST /collections/{id}/entries/`：`{entry_id}` 收入词条，不自动收录录音。
- `POST /collections/{id}/recordings/`：`{recording_id, entry_id}` 指定盒内归属；仅未关联录音允许 `entry_id:null`。
- `DELETE /collections/{id}/entries/{item_id}/`、`recordings/{item_id}/`：移出目录／录音，不删除原始资料。
- `POST /collections/{id}/order/`：`{ids:[...]}` 排词条目录；加 `section_id` 排该目录内录音（null 为待整理区）；需完整、无重复的可见条目 ID；不可见条目的相对位置保留。
- 时间字段只读：集盒 `updated_at` 在盒签修改、成员添加/移除或实际排序变化时更新；重复添加及不变排序不改时间。`sections[].created_at` 和各录音成员 `created_at` 表示加入该层级的时间，不是原始词条或录音创建时间。迁移前无法还原的历史时间为 `null`，不以迁移时间伪造；移出后重新加入为新成员时间。
- 实际结构是 Collection → CollectionEntry 词条目录 → CollectionRecording 选定录音，未关联录音置于 pending，不是扁平 CollectionItem。
- 目录响应含 `sections:[{id,entry,recordings:[{id,recording,needs_review}],recording_count}]`、`pending`、`entry_count` 和去重的 `recording_count`。
- `GET /recordings/?following=true`：关注作者的公开录音；游客返回空列表。
- `GET /recordings/daily/`、`random/`：公开每日精选／随机录音；没有候选时返回 204。
- `PUT/DELETE /recordings/{id}/like/`：点赞／取消；返回 `liked`、`like_count`。
- `GET /recording-comments/?recording_id=...&page=...`：标准分页，只返回可见的一级评论；每项含 `reply_count` 和最多 3 条按时间升序的 `recent_replies`。带 `parent_id` 时改为分页读取该评论下的一层回复。
- `POST /recording-comments/`：`{recording_id,body,parent_id:null,reply_to_id:null,client_id:"UUID"}`；`reply_to_id` 必须和 `parent_id` 指向同一条一级评论。同一作者重试相同请求返回原评论，改变内容需新 UUID。
- `DELETE /recording-comments/{id}/`：作者删除／管理员隐藏，该评论下回复不再展示。
- `PUT/DELETE /recording-comments/{id}/like/`：评论点赞／取消。
- `GET /entries/suggestions/?q=...`、`popular/`：最多 8 个公开词条；推荐依照公开录音点赞及有效地区补证，不计私人收藏，不记录搜索原词。

评论、回复和点赞通知复用消息中心，跳转录音详情；不重复发送自身通知，消息正文不复制录音或评论原文。

### Entry 讨论（v1 能力二次补缺）

`GET /entry-comments/?entry_id=<id>&page=1` 浏览可见词条讨论，返回字段与录音讨论一致；带 `parent_id` 时读取该评论下的一层回复。`POST /entry-comments/` 接收 `entry_id`、`body`、`client_id`（UUID）及可选 `parent_id`、`reply_to_id`。POST 必须且只能给出 entry_id，不能混入 recording_id；目标未公开即使本人可读取，也不能新增评论。一级回复必须属于同一词条，`reply_to_id` 必须指向该一级评论下的回复；重复 UUID 与不同目标／正文冲突返回 400。

`DELETE /entry-comments/{id}/` 作者删除／管理员隐藏；`PUT` / `DELETE /entry-comments/{id}/like/` 点赞／取消。录音与词条接口互不读取或修改对方评论。事件为 `entry.comment`、`entry.reply`、`entry.comment_like`，通知回到对应词条；不把评论正文放进通知。隐藏主评论后回复同样不公开展示。

消息中心 `GET /notifications` 支持 `unread`、`page`、`pageSize` 和逗号分隔的 `verb` 过滤；`verb=entry.comment,entry.reply` 表示按事件类型做 OR 筛选。评论与回复通知的 `target` 还带 `comment_id` 和 `parent_comment_id`：顶层评论用前者定位一级评论，回复用后者进入对应讨论串并加载具体回复。未知 `verb` 返回 400，避免拼错后静默返回空列表。`reply`、`like`、`bookmark` 等前端分类应映射到对应事件组，不要新增含义模糊的客户端过滤。
