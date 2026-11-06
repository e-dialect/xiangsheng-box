# 2026-11-06：核心 UI 与演示站版本对齐

任务：[工作包 #559](https://github.com/e-dialect/xiangsheng-box/issues/559)；审查：[Draft PR #560](https://github.com/e-dialect/xiangsheng-box/pull/560)。执行分支：`codex/ui-phase-one`。

## 对齐结论

用户确认继续以 `xiangsheng-judge` 演示站及 2026-10-24 部署记录为依据；本次没有读取当前容器或操作生产服务。目标是让下一版从统一源码构建，不再依赖旧本地 HEAD 或临时目录里的增量源码。没有执行 PR 合并、镜像发布、部署或生产数据修改。

- 原本地 HEAD：`3e27446cfbe9566733ab437169b414607a3d86ac`。
- 2026-11-06 fetch 后主线：`c8993f3d720e5a932d284fceb62e81dd673b6e3f`，比原 HEAD 新 23 个提交；本分支已 rebase 到该提交。
- 公开初稿修复：`120cd94eeec74e22e8c522885a4b22283adbb7bd`。
- 核心 UI / 成员反馈：`d84b1522cb1a6bdaa26ba183482209260ce86d2d`。
- 后续兼容修正使用主线 `contributionStatus` / `contributionSuccessMessage`；提交成功使用“已提交，等待审核”，公开范围在提交前及录音上下文分别说明。

## 已记录部署与下一版对应关系

| 演示站记录中的来源 | 统一源码中的承接 | 本次核查 |
| --- | --- | --- |
| 后端 `curation-0d18ef0`：地区范围保护、历史授权快照、同行历史权限 | 主线 `2b8957a` 及 `v2_scope.py` / `v2_history.py` / `v2_governance.py` | 主线保留并加强保护；没有拿旧后端覆盖；相关回归通过 |
| 前端 `stage2-59ae474`：词条来源、范围修正和动作详情 | 主线 `bde136f` 的整理工作台 | 词条整理入口保留；staff 验证、账号切换、证据确认和部署前缀修复保留；浏览器回归通过 |
| 前后端 `recording-public-20261024` 的增量修复 | `120cd94` 和本轮录音 UI | 创建默认公开但仍为 draft；显式私有、历史私有和退回隔离不变；列表/详情标识与提交说明保留 |
| 演示站旧上传基础版本 | 主线 `42c33ba` 的浏览器音频格式修复 | 上传相关测试纳入回归 |
| 原本地依赖版本 | 当前主线 package.json / yarn.lock | 按 frozen lockfile 安装；本轮没有额外升级依赖或修改锁文件 |

迁移 `0027_curationaction_authority_snapshot` 与记录中的后端 `0d18ef0` 文件一致；本轮未新增 migration。这只是源码比较，不能代替数据库已应用迁移或备份恢复的现场证据。

## 本次验证

| 检查 | 结果 |
| --- | --- |
| `npm run lint` | PASS |
| `npm run test:unit -- --reporter=dot` | 86 文件、634 项通过 |
| `npm run build:h5:checked` | PASS，无 warning audit 违规 |
| `npm run build:mp-weixin:checked` | 编译成功；严格门禁 FAIL，原因是 uni-app 5.34 新版本通知。未修改审计规则或扩大依赖升级范围 |
| 6 组相关 H5 Playwright（本机 Edge、模拟 API） | 共 53 项：首轮 47 通过、6 项截图/字体超时；仅重跑失败项 6/6 通过 |
| Django 定向：API / scope / provenance / governance / files | 92 项：91 通过、1 项 SQLite 行锁跳过 |
| Django 全量，包含 config | 运行 278 项，报告 8 处失败、1 跳过；失败均在 config（含子测试），未将其余项推算为通过数 |
| 未修改主线 config 对照 | 14 项中相同 8 项失败；包含 Windows 精简子进程环境 WinError 10106 与临时 env 文件可读性问题，不宣称完整后端门禁已通过 |
| Django `check` / `makemigrations --check --dry-run` | PASS / 无模型变更 |
| Black（本次后端差异） / API contract | PASS / PASS |
| `git diff --check` | PASS |

微信严格构建已重跑，仍出现版本通知；未修改主线的隔离对照构建在该次运行通过，故只记录通知差异，不声称已证明它在每次主线构建上都发生。该门禁仍需 CI / 后续编译器维护任务确认。

本次 Edge 重跑的[账户暗色截图](assets/ui-2026-11-06/account-dark.png)和[桌面录音截图](assets/ui-2026-11-06/record-desktop-light.png)已归档。

完整本地日志：`tmp/p0-{lint,unit,h5-build,mp-build-final,backend-tests,backend-targeted,e2e,e2e-retry}.log`；主线对照为 `tmp/p0-main-{config-tests,mp-build}.log`。日志不随产品源码提交。11 月 3 / 5 日历史截图已选择归档至 `docs/assets/ui-phase-one/` 与 `docs/assets/ui-2026-11-05/`，原分支的测试数字不作为同步后的门禁结果。

## 合入和后续发布边界

本工作包含默认公开行为，按 R2 记录；PR 以 Draft 提供审查。维护者仍需针对可见性 contract、失败路径进行审查并验收。没有替人勾选人工验证、贡献权利或 CLA。

下一版应在 PR 合入且对应 main 的 CI gate 成功后，使用 release workflow 的不可变镜像与 manifest 固定 digest；前后端来自同一源码版本，不再单独叠加 `recording-public` 源码。操作说明见 [生产镜像](PRODUCTION_IMAGES.md)。

发布实施前需要从目标站读取当前镜像及迁移状态，保留原网关、环境配置和数据挂载，并准备一致性私有备份和应用镜像回滚。不要把旧备份覆盖运行中的新数据，也不要反向移除 0027 快照列。

Not manually verified：当前线上容器版本、真实 A/B/C 账号的新提交/播放/整理闭环、微信 iOS/Android 真机、麦克风系统权限、实际软键盘、Parent Test、生产备份恢复以及 PostgreSQL 并发撤权。以上均不因本次源码对齐视为已完成。

未纳入本 PR：工作区原有阶段汇报、演示手册和整个 `output/`（包含旧工作树、打包产物及本地验证材料），均原样保留。
