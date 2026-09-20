# 乡声集盒

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/e-dialect/xiangsheng-box)

乡声集盒是“乡声万语”面向普通用户的地方语言工具、互动与可信共建平台。

本仓库是旧 `e-dialect/hinghwa-dict-v2` 的正式替代项目；旧仓库已经停止维护并归档。

用户首先因为“有用、好玩、值得表达和分享”而来：查一个家乡词、听真人怎么说、录下自己或家人的说法、比较不同地方的表达、体验 ASR/TTS。正常使用过程同时沉淀为带来源、地区/语言背景和证据链的语言资料。

当前 2027 春节的 Anchor Language Space 是莆仙方言，Flagship Distribution Profile 是兴化语记。前者定义这门方言缺什么数据，后者定义以什么品牌、内容和表达方式呈现给用户；核心产品与数据模型仍面向多种方言、地方语言与民族语言扩展。

Entry / Recording V2 是当前领域模型：词条可以先于录音存在，录音也可以先以原始大意提交，再由整理员补充写法、编号义、语言背景、地区读音和证据。词条与录音通过带角色的多对多关系连接，不以投票权重自动裁定唯一解释。

## 当前结构

- 核心实体为 `Entry / EntrySense / WritingForm / Concept / PronunciationVariant / Recording / RecordingEntryLink / EvidenceRecord / UsageAttestation / Dialect`。
- 资源 API 使用根路径，例如 `/entries/`、`/recordings/`、`/recording-entry-links/`；旧 Can/Nameplate/Flavor/Package 公共接口已经退役。
- 一级导航为“听 / 查 / 录 / 我”。“我”是完整账户中心，并按授权显示整理入口。
- 材料处理脚本按地域归档在 `tools/materials/`；旧数据库只作为可追溯归档和导入来源，不再是运行时产品模型。

## 文档

你不需要在第一天读完全部文档。按当前目标从以下入口开始。

### 第一次了解项目

1. [长期产品路线](docs/PRODUCT_ROADMAP.md)
2. [2027 春节冲刺](docs/SPRING_FESTIVAL_2027.md)
3. [Contributor Onboarding](docs/CONTRIBUTOR_ONBOARDING.md)

### 开始认领任务

- [AI-native Contributor](docs/AI_NATIVE_CONTRIBUTION.md)
- [Work Package Guide](docs/WORK_PACKAGE_GUIDE.md)
- [乡声共创 / Dialect Experience](docs/CONTRIBUTOR_TRACK_EXPERIENCE.md)
- [方言数字基建 / Dialect Commons](docs/CONTRIBUTOR_TRACK_COMMONS.md)

### 工程参考

- [产品设计](docs/PRODUCT_DESIGN.md)
- [架构说明](docs/ARCHITECTURE.md)
- [API 约定](docs/API.md)
- [身份、游客与审计开发指南](docs/AUTH_AUDIT_GUIDE.md)
- [开发指南](docs/DEVELOPMENT.md)
- [测试说明](docs/TESTING.md)
- [部署说明](docs/DEPLOYMENT.md)
- [兴化语记迁移](docs/HINGHWA_STATION_MIGRATION.md)
- [兴化语记](docs/HINGHWA.md)
- [历史视觉/交互参考](docs/references/README.md)
- [贡献说明](CONTRIBUTING.md)

协作提交请遵循 [贡献说明](CONTRIBUTING.md) 中的 Conventional Commits 风格提交信息：`type: summary` 或 `type(scope): summary`。

## Docker 启动

普通 Docker Compose 会启动前端静态 nginx 和后端 Django，前端通过 `FRONTEND_BACKEND_URL` 访问后端：

```bash
cp .env.example .env
docker compose up --build
```

默认访问：

- 前端：http://localhost:8181
- 后端：http://localhost:8000

如果想用本地域名分流，可以启动 Traefik 版本：

```bash
docker compose -f docker-compose.traefik.yml up --build
```

默认访问：

- 前端：http://guantou.localhost
- 后端：http://api.guantou.localhost

Traefik 只按域名分流，不按 path 前缀分流。前端 nginx 已配置 SPA fallback，直接打开 `http://guantou.localhost/pages/entries/details?id=1` 这类页面路径也会返回 H5 入口。

后端容器启动时会自动执行数据库迁移，运行数据默认挂载到 `data/backend/`。

## 本地开发

后端使用 Python 3.12：

```bash
cd backend/guantou
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

前端使用 Node 22 和 Yarn：

```bash
cd frontend
yarn install --frozen-lockfile --production=false
yarn dev:h5
```

根目录可一键安装开发依赖：

```bash
make setup
```

## 测试

```bash
cd backend/guantou
python manage.py test guantou announcements user siteconfig files inbox audit
black --check announcements guantou user siteconfig files inbox audit utils config

cd ../../frontend
yarn lint
yarn test:unit
yarn build
yarn build:mp-weixin

cd ..
docker compose config
docker compose -f docker-compose.traefik.yml config
```

## 产品原则

- 词条就是可检索的词；没有录音、没有专业写法的初稿也合法。
- 同形但读音或核心意义不同的内容是不同 Entry；“行走的行”和“银行的行”不会混为一条。
- `EntrySense` 只保存同一词条下的相关编号义；`Concept` 用于发现 WALK、RUN 等跨词条关联，不触发合并。
- 一条录音可关联主要词条、句中词和竞争解释；原始大意与来源证据不可被整理结果覆盖。
- 方言点是按需建立的树：默认精确查询，只有显式指定 subtree 时才包含下级方言。
- AI、相似度和社区补证只能提供整理依据，不能自动裁判正字或选主。

## 许可证

本仓库中由 e-dialect 有权授权的原创软件代码，除另有说明外，采用
**GNU Affero General Public License v3.0 only（`AGPL-3.0-only`）**发布。

AGPL 允许包括商业场景在内的使用，但使用者须遵守其全部条款。无法或不希望遵守
AGPL 条款的组织，可以联系项目维护者了解替代商业许可。

软件许可证不自动适用于数据集、语料、词典内容、录音、用户提交、模型权重、商标、
Logo 或其他单独标识的资产。第三方组件继续适用原许可证。详见
[`LICENSING.md`](LICENSING.md)、[`ASSET_BOUNDARIES.md`](ASSET_BOUNDARIES.md) 和
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
