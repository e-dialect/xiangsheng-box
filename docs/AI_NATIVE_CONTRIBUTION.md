# AI-native Contributor 协作指南

## AI 可以协助实现，但贡献责任仍属于贡献者

项目允许并鼓励使用 coding agent。我们不以“是否逐行人工阅读所有 AI 输出”衡量责任，而以目标理解、风险识别、实际验证、证据和诚实披露衡量。

> **Human review is risk-targeted, not line-count-driven.**

## 不可外包的责任

```text
理解用户/系统问题
→ 判断方案是否符合项目约束
→ 按风险检查关键 diff 与 contract
→ 亲自运行必要验证
→ 亲自体验用户路径 / 检查数据结果
→ 如实记录未人工验证部分
→ 能解释 PR 为什么是对的、最可能如何失败
```

## 风险分级

### R0 · Low Risk

适用于文案、CSS、小 UI、局部配置和容易回退的小范围 bug。

要求：agent review、CI / 相关自动检查、作者实际运行或完成视觉验证，并记录 Evidence 与 `Not manually verified`。

### R1 · Normal Business Logic

适用于 Campaign、普通 API、常规 task flow 等业务逻辑。

要求：独立 agent review、与影响范围匹配的自动化测试、作者走完完整用户旅程或目标行为、理解预期行为与影响范围，并记录 Evidence 与 `Not manually verified`。

R1 不强制第二名人类逐行审查所有实现；关键是目标旅程和实际行为得到验证。

### R2 · High Risk

适用于 migration、auth、permission、Visitor → User merge、consent、Speaker provenance、deletion、production deployment、destructive import 等高风险变更。

要求：agent review、自动化测试、人类针对关键 contract/文件/失败路径审查、staging / backup / rollback 证据、@aB0T-bupt 验收，并记录 Evidence 与 `Not manually verified`。

涉及品牌、隐私/同意、许可证/CLA、商业条款、资金、不可逆架构、破坏性迁移或共享 X/W Contract 重大变化时，还必须按组织治理规则升级 Steering。

## 推荐六步法

1. 自己读 Issue，用一句话写出“完成后用户/系统会发生什么”。
2. 先让 AI 调查现状、相关文件、测试和风险。
3. 为 PR 标记 R0 / R1 / R2，并把工作拆到一个清晰行为与 Demo Moment。
4. 检查风险集中的关键 diff、migration、API/schema、权限、测试断言和用户文案。
5. 亲自运行与风险匹配的 lint / test / build / E2E / 用户旅程 / migration rehearsal。
6. 最后让独立 agent 对当前 diff 专门寻找 bug、scope creep、遗漏测试与项目约束违反。

## PR 作者自检

```markdown
### 作者自检
- [ ] 我能用自己的话解释这个 PR 解决了什么问题
- [ ] 我已标记 R0 / R1 / R2，并检查对应关键路径
- [ ] 我确认没有无关改动或秘密扩大 scope
- [ ] 我亲自运行了下方列出的验证
- [ ] 我人工验证了最关键用户/数据路径（若适用）
- [ ] 我没有把 AI 的“测试通过”当作真实验证
- [ ] 我知道这个 PR 最可能出问题的地方

### 实际运行的验证
- `...` → PASS / FAIL

### Not manually verified
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

Size 按人类判断、错误代价、验证面和 review complexity，而不是 AI 生成速度。能力不足时缩小任务粒度，不降低验收标准。
