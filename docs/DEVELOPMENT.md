# 开发指南

## 运行环境

- Python 3.12
- Node.js 22
- Yarn
- Docker Compose
- ffmpeg

后端位于 `backend/guantou`，前端位于 `frontend`。根目录负责 Docker、CI、文档和部署。

## Docker 开发

```bash
cp .env.example .env
docker compose up --build
```

默认地址：

- 前端：`http://localhost:8181`
- 后端：`http://localhost:8000`

后端 SQLite、媒体文件和日志挂载在 `data/backend/`。普通 Docker Compose 下，前端 nginx 只提供静态文件，H5 通过 `FRONTEND_BACKEND_URL` 访问后端，默认是 `http://localhost:8000`。

如果想用接近生产的本地域名分流，可启动 Traefik 版本：

```bash
docker compose -f docker-compose.traefik.yml up --build
```

默认访问 `http://guantou.localhost`，后端访问 `http://api.guantou.localhost`。Traefik 按 host 分流，不按 path 前缀分流。前端 nginx 保留 H5 history fallback，因此直接打开 `/pages/...` 下的任意页面路径也会返回前端入口。

## 后端本地运行

```bash
cd backend/guantou
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

音频上传会把 MP3、WAV、M4A 统一编码为 MP3，因此本地需要同时提供 `ffmpeg`
和 `ffprobe`。macOS 可运行 `brew install ffmpeg`，Debian/Ubuntu 可运行
`sudo apt-get install ffmpeg`。安装后执行以下显式探测：

```bash
python manage.py probe_audio
```

普通迁移、非音频测试和服务启动不会主动加载 pydub 或探测二进制；仅在音频
上传时缺少能力才返回 503 的稳定 API 错误。Docker 镜像构建会分别执行
`ffmpeg -version` 与 `ffprobe -version`，避免把缺失能力的镜像发布出去。

### 后台管理员

仓库和容器不会创建带固定密码的默认管理员，测试代码中的管理员也只存在于临时测试库。
首次需要访问 `http://localhost:8000/admin/` 时，在本地目标库手工创建：

```bash
python manage.py createsuperuser
```

方言点是 `guantou.Dialect` 数据库对象，可在后台新增、修改、调整父节点、排序或删除。
方言 migration 只负责首次补齐基线，后端启动不会重复导入或覆盖人工维护的数据。

后端应用按领域划分，不要求所有新代码都塞进 `guantou` app。词条、编号义、写法、概念、地区读音、录音、证据与整理治理归入 `guantou`；账户归入 `user`；公告归入 `announcements`；后台可编辑运营配置归入 `siteconfig`；邮箱验证码归入 `user`；文件上传归入 `files`；站内通知归入 `inbox`。更完整的边界说明见 `docs/BACKEND_GUIDE.md`。部署环境变量仍由 `config/settings.py` 读取，不放入数据库。

客户端能力开关、第一方产品事件白名单和 90 天保留任务见 [`PLATFORM_CAPABILITIES_ANALYTICS.md`](PLATFORM_CAPABILITIES_ANALYTICS.md)。部署环境应每日运行 `python manage.py aggregate_product_events`；请求路径也会每日机会式执行一次，确保低流量环境不因漏配定时任务无限保留明细。

离线方言材料处理脚本放在根目录 `tools/materials/`。跨方言通用逻辑进入 `common/`，莆仙话拼音、IPA 和旧表格清洗逻辑进入 `puxian/`。这些脚本不属于 Django 后端运行依赖。

## 前端本地运行

```bash
cd frontend
yarn install --frozen-lockfile --production=false
yarn dev:h5
```

默认 API 地址为 `http://localhost:8000`。需要覆盖时设置：

```bash
VITE_BACKEND_URL=http://localhost:8000 yarn dev:h5
```

手机验证码登录默认隐藏。只有后端验证码投递已可用时，才在 H5 开发或构建前设置
`VITE_PHONE_CODE_LOGIN_ENABLED=true`；Docker Compose 构建会读取根目录 `.env` 中的该值。
账号密码登录、邮箱注册和邮箱找回密码始终可用。

新页面优先使用 `src/services/entryRecording.js` 调用 Entry / Recording 根路径资源接口；方言树和方言圈使用 `src/services/guantou.js`。不要恢复 Can/Nameplate 客户端流程，也不要新增 api 前缀。页面、服务层和组件约定见 `docs/FRONTEND_GUIDE.md`。

## 前端工具边界

`src/utils/httpClient.js` 是统一请求内核。`src/utils/request.js` 和 `src/utils/rawRequest.js` 保留为兼容包装：

- `request`：用于普通业务请求，默认带 `Authorization: Bearer <token>` 和 `X-Visitor-ID`，错误会提示，401 会跳登录。
- `rawRequest`：用于登录、注册、刷新 token 等流程，默认带 `Authorization: Bearer <token>` 和 `X-Visitor-ID`，但错误静默，不自动跳登录。

默认可见请求通过 `services/feedback.js` 共用一份全局 loading 引用计数：首个请求显示、最后一个请求结束才隐藏。H5 的原生 loading 与 toast 共用弹层，Host 尚未挂载时产生的错误提示会等 loading 完成关闭后再显示；页面不要绕开该服务自行配对全局 loading。

登录、注册、微信登录/注册等公开入口必须显式传 `{ auth: false }`，避免浏览器或小程序本地残留的旧 token 污染 public 请求。刷新 token、加载当前用户信息等需要登录态的流程继续使用默认 `auth: true`。

`src/polyfill` 和 `src/utils/u-parse` 是旧 uni-app 迁移兼容层。它们不是 uni-app 编译微信小程序的必需依赖；删除前必须先确认源码不再依赖对应能力，并通过 H5、mp-weixin 构建和 H5 E2E。
