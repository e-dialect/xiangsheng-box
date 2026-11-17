# 部署说明

## 普通 Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

该模式下前端 nginx 只提供静态 H5，不反向代理后端。H5 默认访问 `FRONTEND_BACKEND_URL=http://localhost:8000`，适合本机开发和快速检查。

## Traefik 本地域名 Compose

```bash
cp .env.example .env
docker compose -f docker-compose.traefik.yml up --build
```

默认绑定本机 80 端口，并按域名分流：

- `http://guantou.localhost`：前端 H5。
- `http://api.guantou.localhost`：后端 Django。

Traefik 不按 path 前缀区分前后端，这样资源路径可以在后端域名下保持清晰，例如 `http://api.guantou.localhost/entries/`。前端 nginx 只提供静态文件，并通过 `try_files $uri $uri/ /index.html` 支持 Vue/uni-app H5 页面直达，例如 `http://guantou.localhost/pages/entries/details?id=1`。

如果本机 80 端口被占用，可以在 `.env` 中把 `TRAEFIK_PORT` 改成其他端口，例如 `8181`，访问地址也相应变成 `http://guantou.localhost:8181` 和 `http://api.guantou.localhost:8181`。

生产部署也建议采用这个职责划分：前端 nginx 只 serve 静态文件，Traefik 或其他网关统一负责后端路由、TLS、域名和中间件。不要在前端镜像里维护后端反向代理规则。

主要环境变量：

- `BACKEND_PORT`：后端映射端口，默认 `8000`。
- `FRONTEND_PORT`：前端映射端口，默认 `8181`。
- `TRAEFIK_PORT`：Traefik 本地入口端口，默认 `80`。
- `FRONTEND_BACKEND_URL`：普通 Compose 下前端运行时访问的后端地址，默认 `http://localhost:8000`。
- `TRAEFIK_FRONTEND_BACKEND_URL`：Traefik Compose 下前端运行时访问的后端地址，默认 `http://api.guantou.localhost`。生产独立后端子域名部署时可设置为 `https://api.example.com`。
- `SECRET_KEY`、`JWT_KEY`：Django 和旧 token 兼容所需密钥。
- `APP_SECRET`：微信小程序密钥；旧拼写 `APP_SECRECT` 暂时兼容，但不建议继续新增使用。
后端数据目录为 `data/backend/`。生产部署前应配置真实密钥、对象存储和邮件参数。

## 网页与 App 的微信登录

网页和原生 App 共用正式小程序中的 `pages/login/wechat-confirm`。手机网页和 App 使用微信 URL Link，电脑网页使用小程序码。

1. 核对后端 `APP_ID` 与正式小程序的 AppID 一致，确认该小程序可生成 URL Link 和小程序码，并已配置后端 HTTPS 请求域名。
2. 部署包含数据库迁移的后端，发布包含确认页的小程序。H5 和 App 的构建使用同一套后端。小程序和 App 构建时把 `VITE_BACKEND_URL` 指向该 HTTPS API。
3. 将后端的 `WECHAT_BRIDGE_WEB_ENABLED` 和 `WECHAT_BRIDGE_APP_ENABLED` 分别设为 `true`。两个开关默认关闭，关闭对应开关会停止该入口发起和完成微信登录。
4. 用 iOS Safari、Android Chrome、微信内置浏览器、电脑扫码和 Android／iOS 安装包各验一次。覆盖已有账号、首次注册、取消与超时。确认后手动切回原网页或 App。

## GitHub Actions

- `.github/workflows/ci.yml`：默认 CI，执行后端、前端和 Docker 检查。
- `.github/workflows/deploy-cos.yml`：手动 H5 部署到腾讯云 COS，不自动触发。

## 手动 COS 部署

在 GitHub Actions 中手动运行 `Deploy H5 to Tencent COS`，填写：

- `target_prefix`：COS 目标前缀，例如 `guantou-preview/`。
- `backend_url`：H5 访问的后端 API 地址。

需要配置以下 secrets：

- `TENCENT_CLOUD_SECRET_ID`
- `TENCENT_CLOUD_SECRET_KEY`
- `TENCENT_CLOUD_BUCKET`
- `TENCENT_CLOUD_REGION`

旧 PR preview 和 master 自动部署不再启用。需要恢复时，应先确认新仓库域名、分支策略和 secrets，再新增自动触发规则。
