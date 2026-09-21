# 贡献说明

乡声集盒是由原前后端仓库合并后的单一仓库。新功能应优先围绕 `docs/PRODUCT_DESIGN.md` 和 Entry / Recording V2 当前领域模型实现；方言材料处理脚本按地域放在 `tools/materials/`，不进入 Django 运行路径。

产品优先级、Contributor 双 Track、AI-native 责任边界和 Work Package 拆分分别见
`docs/PRODUCT_ROADMAP.md`、`docs/CONTRIBUTOR_TRACK_EXPERIENCE.md`、
`docs/CONTRIBUTOR_TRACK_COMMONS.md`、`docs/AI_NATIVE_CONTRIBUTION.md`
与 `docs/WORK_PACKAGE_GUIDE.md`。

这份文件只保留所有贡献者都需要知道的规则。第一次参与项目，建议按下面顺序阅读：

- `docs/CONTRIBUTOR_ONBOARDING.md`：从选 issue 到发 PR 的新手路线图，也说明不同难度的任务应该读多少代码。
- `docs/FRONTEND_GUIDE.md`：uni-app/Vue3 前端目录结构、页面写法、服务层和通用反馈约定。
- `docs/BACKEND_GUIDE.md`：Django 后端目录结构、应用边界、API 路由、权限认证和全局异常行为。
- `docs/ARCHITECTURE.md`：Entry、Recording、PronunciationVariant、Evidence、Dialect 等当前领域模型关系。
- `docs/PRODUCT_DESIGN.md`：产品语言和用户体验目标。

如果你只是修正文案、样式或一个很小的 bug，先读 `CONTRIBUTOR_ONBOARDING.md` 就够了；如果要新增页面，请读前端指南；如果要新增接口、模型或数据导入逻辑，请读后端指南和架构说明。

## 分支与提交

- 分支命名建议使用 `feat/...`、`fix/...`、`docs/...`、`refactor/...`。
- PR 中的提交信息必须使用 Conventional Commits 风格：`type: summary` 或 `type(scope): summary`，例如 `feat(entries): improve pronunciation evidence` 或 `fix(recordings): preserve draft metadata`。
- 常用类型：`feat`、`fix`、`docs`、`test`、`refactor`、`build`、`ci`、`chore`、`revert`。
- `scope` 使用小写英文、数字或短横线，并且必须是有归属的领域或模块，从现有词表里选：`entries`、`recordings`、`collections`、`circles`、`discussion`、`inbox`、`articles`、`curation`、`audit`、`announcements`、`siteconfig`、`themes`、`user`、`search`、`analytics`、`api-contract`、`materials`、`ci`。词表里没有合适的项时，在 PR 描述中说明新 scope 对应哪个目录或领域，再补进本表。
- 不要用阶段、版本或计划代号作 scope（`v2`、`v3`、`phase1`、`M1` 等），也不要用整层名字（`frontend`、`backend`、`core`）：它们不携带责任域信息，changelog 无法据此归类。`feat(v2): …` 是重构期间的历史写法，属于错误示范，不要沿用——`v2_views.py` 之类的旧文件名同理，不构成 scope 依据。「Entry / Recording V2」只在指称领域模型本身时才出现在标题正文里。
- 一支 PR 确实跨两个领域时，scope 写主要的那个，另一个写在 PR 描述里；不要用「A 与 B」把两件东西拼进标题来回避 scope 选择。
- PR 标题与提交信息的首行都不带 issue 编号（`(#405)`、`(#405) (#406)`、`fix #406` 等）。issue 关联只写在 PR 描述的「Related Issue」里：完成用 `Closes #123` / `Fixes #123`，只覆盖一部分用 `Relates to #123` 并在正文逐条说明遗留范围。Squash and merge 会把 PR 描述带进提交说明，所以关联不会因为标题里没有编号而丢失。标题里出现编号几乎总是一个来源错误：把合并后自动生成的提交信息回填成了 PR 标题。
- PR 分支应保持干净：不要包含 `WIP`、`fixup!`、`squash!`、无关 merge commit 或与本次工作无关的历史提交。仅当治理/发布指令明确要求保留可审计历史且禁止 rebase/force-push 时，可以正常合入当前默认分支；CI 只接受额外 parent 已属于当前 base 历史的同步 merge。
- 仓库初始化提交 `init` 是历史重写时的特例；后续普通提交不使用裸 `init` 或自由格式信息。

## 本地检查

后端：

```bash
cd backend/guantou
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test guantou announcements user siteconfig files inbox audit
black --check announcements guantou user siteconfig files inbox audit utils config
```

前端：

```bash
cd frontend
yarn lint
yarn test:unit
yarn build
yarn build:mp-weixin
```

Docker：

```bash
docker compose config
docker compose -f docker-compose.traefik.yml config
docker compose build backend frontend
```

也可以在根目录运行：

```bash
make check
```

## 旧系统约束

- 不再为旧 `/words`、`/pronunciation` API 增加新客户端功能。
- 涉及方言材料导入或清洗时，先在 `tools/materials/README.md` 说明适用方言、输入输出和依赖，再新增或调整脚本。
- 新文档只维护根目录 `README.md` 和 `docs/`，不要在子仓库目录继续新增分散说明。

## 参考来源

本仓库的协作规范继承 e-dialect 组织级贡献说明的基本原则：尊重开源许可证、认领 issue、使用清晰分支和 Conventional Commits、通过 PR 评审合并。旧仓库 `hinghwa-dict-web`、`hinghwa-dict-uni-app`、`hinghwa-dict-backend` 只作为迁移历史参考；新代码应以本仓库 `docs/` 和当前目录结构为准。
