# H5 录音跨账号可见性核查

核查日期：2026-10-24（北京时间）。范围：只读分析本地代码、用户提供的线上日志及数据库查询结果；未修改线上数据或应用逻辑，未运行发布或实际审核操作。

## 结论

上传成功后的录音是服务器初稿，不是仅保存在浏览器的本地草稿。当前创建流程默认生成 `status=draft, visibility=False` 的录音，列表权限过滤使其他普通账号看不到它。不存在必须额外调用但前端漏调的独立“提交审核”步骤：审核概览直接统计 draft/disputed 录音，整理员审核为 published 时设置 visibility=True。

这解释了反馈，但不能据此判为“没有 bug”。ADR-0006 明确要求粗略记录可公开成为初稿，无整理员地区仍可公开并显示待证；当前默认隐藏的实现与该设计存在差异。应区分审核状态与公开状态，而不是把 draft 一律理解为私有。

## 线上证据

用户提供的只读查询结果：

| 录音 | 上传账号 | 词条 | 状态 | visibility |
| --- | --- | --- | --- | --- |
| 9 | 11 | 11 | draft | False |
| 10 | 11 | 12 | draft | False |

10 月 23 日词条 11 的录音列表请求：21:29:31 返回 924 字节，21:30:44 返回 52 字节；Android Chrome 在 21:40:06 返回 52 字节、21:40:54 返回 924 字节，21:45:16 音频文件请求返回 200。21:52:33 和 21:52:43 列表再次返回 52 字节。响应大小提示列表内容变化，但日志未记录响应正文或认证账号，不能仅凭浏览器标识认定 A/B 账号或证明 52 字节一定是空列表。

## 代码依据

- `frontend/src/pages/recordings/create.vue` 的 submit：保存本地恢复草稿，上传文件，调用 createRecording；payload 未传 visibility；成功提示“乡音已保存为可追溯初稿”，清理本地草稿并跳转服务器录音详情。
- `backend/guantou/guantou/v2_serializers.py` 的 RecordingSerializer.create：事务创建录音、初始关联及证据；录音状态和可见性沿用模型默认值。
- `backend/guantou/guantou/models.py` 的 Recording：status 默认 draft，visibility 默认 False。
- `backend/guantou/guantou/v2_views.py` 的 visible_recordings_for_user：普通账号只能查询公开录音或自己录制的录音；管理员及范围内地区整理员有额外权限。
- 同文件 CurationView：draft/disputed 录音直接计入 pending_recordings，按整理员地区范围过滤。
- `backend/guantou/guantou/v2_governance.py` 的录音审核分支：published 设为公开，rejected 设为隐藏，并保存状态和可见性。
- `frontend/src/pages/curation/index.vue`：存在“发布”动作，说明资料会进入公开可用状态。
- `docs/adr/0006-entry-sense-recording-domain.md` 第 11、110 行：要求初稿可公开、无整理员地区内容仍可公开并显示待证。
- `frontend/src/services/recordingDrafts.js` 与 recordingDraftAudio.js：本地草稿元数据存于浏览器存储，H5 音频使用 IndexedDB，与服务器 Recording 是两套数据。

## 测试覆盖与限制

现有 test_recording_minimum_submission_creates_draft_entry_link_and_evidence 检查创建、关联、证据及原文保留，没有验证新提交录音对其他普通账号是否可见。这轮仅做静态核查，未执行测试，未验证线上审核发布操作或线上源码与本地源码完全一致。

后续修复应依据已记录的公开初稿要求处理普通提交的可见性，并增加 A 创建、B 列表及详情可访问的回归验证；保留明确隐藏、拒绝及历史私有记录的访问限制。不可批量将既有 draft 录音全部公开。线上录音 9、10 保持原状，待明确审核或修复方案后再处理。

## 经授权实施的修复

普通 API 创建录音时，缺省 visibility 改为 True，状态仍为 draft；显式 False 仍被保留。模型默认值不变，未新增迁移，不会自动改变历史或导入记录。公开与未公开初稿在共享录音卡片上分别显示“初稿·待核对”和“未公开初稿”，提交成功提示说明已公开。

后端 API 与治理共 23 项测试通过，新增覆盖普通账号跨账号列表、词条关联列表、详情音频 URL、显式私有和历史私有记录隔离、审核退回后列表和详情不可见。前端相关 5 个测试文件共 32 项测试通过，覆盖标识、提交反馈和本地草稿。Lint、H5 和微信小程序构建通过。随后补充提交前公开说明。测试没有实际播放音频或调用线上服务，未完成 390×844 明暗主题人工视觉检查；历史录音 9、10 未变更。
