# 乡声集盒

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/e-dialect/guantou)

乡声集盒是一个多方言语音采集与校验客户端。

产品以“词条（Entry）—录音（Recording）”为核心：词条可以先于录音存在，录音也可以先以原始大意提交，再由整理员补充写法、编号义、地区读音和证据。词条与录音通过带角色的多对多关系连接，不以投票权重自动裁定唯一解释。

## 当前结构

- 核心实体为 `Entry / EntrySense / WritingForm / Concept / PronunciationVariant / Recording / RecordingEntryLink / EvidenceRecord / UsageAttestation / Dialect`。
- 资源 API 使用根路径，例如 `/entries/`、`/recordings/`、`/recording-entry-links/`；旧 Can/Nameplate/Flavor/Package 公共接口已经退役。
- 一级导航为“听 / 查 / 录 / 我”。“我”是完整账户中心，并按授权显示整理入口。
- 材料处理脚本按地域归档在 `tools/materials/`；旧数据库只作为可追溯归档和导入来源，不再是运行时产品模型。

## 文档

- [产品路线](docs/PRODUCT_ROADMAP.md)
- [乡声共创计划](docs/CONTRIBUTOR_TRACK_EXPERIENCE.md)
- [方言数字基建计划](docs/CONTRIBUTOR_TRACK_COMMONS.md)
- [AI-native Contributor](docs/AI_NATIVE_CONTRIBUTION.md)
- [Work Package 规则](docs/WORK_PACKAGE_GUIDE.md)
- [兴化语记迁移](docs/HINGHWA_STATION_MIGRATION.md)
- [产品设计](docs/PRODUCT_DESIGN.md)
- [历史视觉/交互参考](docs/references/README.md)
- [架构说明](docs/ARCHITECTURE.md)
- [API 约定](docs/API.md)
- [身份、游客与审计开发指南](docs/AUTH_AUDIT_GUIDE.md)
- [开发指南](docs/DEVELOPMENT.md)
- [测试说明](docs/TESTING.md)
- [部署说明](docs/DEPLOYMENT.md)
- [兴化语记](docs/HINGHWA.md)
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
