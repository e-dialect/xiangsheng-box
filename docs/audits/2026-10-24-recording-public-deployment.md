# 公开初稿修复部署记录

部署日期：2026-10-24，北京时间约 16:04 完成服务切换，16:11 完成最终静态资源检查。

## 部署来源

线上基础版本与当前本地 HEAD 不同。为避免撤销线上已有的整理审核和地区范围保护，采用基于现有镜像的增量构建：

- 后端基础：`xiangsheng-judge-backend:curation-0d18ef0`。线上 v2_serializers.py SHA-256 与 git 0d18ef0 对应文件一致：`9bd74f14f3d4d2a05b9b00e8a338c54526454b1e3d4493a7f30767c7d83a2c34`。仅增加创建录音时的 `validated_data.setdefault("visibility", True)`，保留地区范围保护。镜像同时加入针对该基础版本的回归测试。
- 前端基础：`xiangsheng-judge-frontend:stage2-59ae474`。从 git 59ae474 导出前端源码，叠加录音卡片标识与提交说明，保留线上整理审核页面，再本地构建 H5 资源。
- 新镜像：前后端分别使用 `xiangsheng-judge-backend:recording-public-20261024`、`xiangsheng-judge-frontend:recording-public-20261024`。
- 更新后端文件 SHA-256：`ddcff9ca0db65f382ef9af7d3ea87a224dabd16c444fa5e8d90057c53b6e33ff`。

## 包、验证和切换

本地包：`output/deploy-recording-20261024/recording-public-20261024.tar.gz`。
SHA-256：`67ac7c8b9435ba344f3eae36f98a1b8bd6c90878be6548d95aa58cf144cf8a04`。
通过已登录阿里云 Workbench 上传至 `/home/admin/`，整包与包内文件哈希验证通过。

服务器在 `--network none`、临时 `/data` 和 `/tmp` 的独立容器中执行后端 API/治理回归，23 项通过；测试不挂载线上数据库。本地针对线上前端基础版本运行初稿标识、核心流程、提交反馈及整理审核测试，30 项通过；H5 构建通过。

数据库通过 SQLite backup API 在容器 `/data/deploy-backups/recording-public-20261024/` 及重试目录 `recording-public-20261024-retry/` 创建一致性备份，目录权限 0700，备份文件权限 0600。对应宿主机目录位于 `/opt/xiangsheng-box/data/judge/backend/deploy-backups/`。未新增迁移、未批量更改历史录音。

首次切换因 Compose 未指定原 `.env.judge` 而在配置校验阶段失败，容器未变。更正为 `--env-file .env.judge` 后重新备份、切换成功，网关 reload 成功。运行日志分别位于 `/home/admin/recording-public-20261024-prepare.log` 和 `/home/admin/recording-public-20261024-activate-with-env.log`。

## 最终验证

- 前后端容器运行新镜像，后端健康状态 healthy。
- 后端源码哈希与部署包一致。
- 前端容器 HTTP 返回 200，`EntryRecordingCard.CH3aepv8.js` 包含“初稿·待核对”，运行时 API 占位符已替换。
- 公网首页返回 302 到原有 `/demo-access/`，未认证 API 返回 401，均符合访问口令配置；公网 `/api/healthz` 的 404 是网关明确屏蔽规则，健康检查使用后端内部 `/healthz`。
- 线上录音 9、10 保持 `draft`、`visibility=False`。

Not manually verified：未在真实账号中新增录音、跨账号实际播放，未向线上写入测试内容；未进行完整明暗主题视觉验收。新提交行为由独立容器 API 回归验证，历史录音保持不变。

验证截图：`output/deploy-recording-20261024/deployment-verified.png`。

## 回滚

服务器保留旧镜像和 `/opt/xiangsheng-box/docker-compose.recording-public-rollback.yml`。仅回退应用镜像，不恢复数据库备份覆盖运行数据：

```sh
cd /opt/xiangsheng-box
sudo docker compose --env-file .env.judge -p xiangsheng-judge \
  -f docker-compose.judge.yml \
  -f docker-compose.curation-0d18ef0.yml \
  -f docker-compose.stage2-59ae474.yml \
  -f docker-compose.recording-public-rollback.yml \
  up -d --no-build --no-deps backend frontend
# 等待后端 healthy 后重载网关：
sudo docker exec xiangsheng-judge-gateway-1 nginx -s reload
```

后续部署需包含 `/opt/xiangsheng-box/docker-compose.recording-public-20261024.yml`，或将该修复正式合并到下一版本；不能只运行旧的基础 Compose 而遗漏覆盖文件。本次未创建 Git 提交或 PR。
