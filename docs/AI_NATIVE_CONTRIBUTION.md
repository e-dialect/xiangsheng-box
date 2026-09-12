# AI-native Contributor 协作指南
## AI 可以替你写代码，但不能替你承担贡献责任

项目允许并鼓励使用 coding agent，但不接受 AI-unverified development。

## 不可外包责任

```text
理解需求
→ 判断方案符合项目约束
→ 亲自检查 git diff
→ 亲自运行必要验证
→ 亲自体验用户路径 / 检查数据结果
→ 能解释 PR 为什么是对的
```

## 推荐六步法

1. 自己读 Issue，用一句话写出“完成后用户/系统会发生什么”。
2. 先让 AI 调查现状、相关文件、测试、风险，不要第一步就改代码。
3. 小步实现：一个行为、一个可 review diff、一个验证点。
4. 自己阅读新增/删除文件、关键业务逻辑、migration、API/schema、测试断言和用户文案。
5. 自己运行与风险匹配的 lint / test / build / E2E / 人工旅程 / migration rehearsal。
6. 最后可让 AI 对当前 diff 再做一次只找 bug、scope creep、遗漏测试与项目约束违反的 review。

## PR 作者自检

```markdown
### 作者自检
- [ ] 我能用自己的话解释这个 PR 解决了什么问题
- [ ] 我完整检查过 `git diff`
- [ ] 我确认没有无关改动/秘密扩 scope
- [ ] 我亲自运行了下方列出的验证命令
- [ ] 我人工验证了最关键用户/数据路径（若适用）
- [ ] 我没有把 AI 的“测试通过”当作真实验证
- [ ] 我知道这个 PR 最可能出问题的地方

### 实际运行的验证
- `...` → PASS / FAIL

### 未运行
- `...`：原因 ...

### AI 使用说明
- 使用工具：...
- AI 主要帮助：调查 / 实现 / 测试 / 文档 / review
- 我本人重点检查了：...
```

## Size

- XS：低判断、低风险、单点、容易验证。
- S：一个清晰独立成果；默认 contributor 工作包。
- M：跨层、contract、migration、多端或高验证成本。
- L：禁止直接认领，继续拆。

Size 按人类判断、错误代价、验证面和 review complexity，而不是 AI 生成速度。
