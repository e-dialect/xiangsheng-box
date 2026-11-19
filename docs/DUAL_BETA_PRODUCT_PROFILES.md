# H5 双站内测与站点版本

`box.test.edialect.top` 的产品名是「乡声集盒内测版」，默认查词不限地区。`pxm.test.edialect.top` 的产品名是「兴化语记 2.0 内测版」，署名 `powered by 乡声集盒`，默认查词范围为「闽.莆仙」及其下级。两个站点使用同一份 H5 构建、同一套账户及业务 API。明确切站会保留公开词条、录音、集盒以及查词条件。浏览器按域名隔离登录态，换站后可用同一账户重新登录。分享链接使用发起页面的域名，登录完成或取消后留在发起站点。

## 运营预览、发布和恢复

1. 系统管理员通过 Django 后台的「产品站点」为编辑分配该站点，并授予该账户 `siteconfig` 的站点版本查看、新增和修改权限。该账户需能登录后台。检查编辑只能看到已分配的站点。
2. 打开「站点版本」，从线上版本的「预览和发布」页面点「复制为新草稿」。按行配置精选，例如 `词条 123`、`录音 45`、`集盒 6`，编号来自已公开内容的页面链接。最多 12 条，按行序展示。通用站可用同一方式推荐莆仙词条、录音和集盒。
3. 保存草稿，打开「预览和发布」，核对品牌、查词范围、地方工具方言和公开精选。点击「发布此版本」，然后以访客身份刷新该站点首页验证。已发布版本保留在历史中，选中历史版本可点击「恢复此版本」。后台操作日志记录发布和恢复者。
4. 地方工具入口使用版本中的方言限定码。部署的前端构建包含地方工具页面时，入口才会出现。中心可另在「地方管理员」给编辑分配具体方言点。编辑随后可维护该点的拼音、题集和称谓包；变更站点版本中的方言限定码只更新公众入口。见[地方资料发布指南](LOCAL_TOOLS.md)。

被撤下、删除或转为非公开的精选会从当前首页消失。恢复旧版时，若旧版仍引用现已不可发布的资料，可复制为草稿、去掉该引用后重新发布。旧版本内容和全局公告轮播配置各自留存。

中性站复用演练可以注册新标识 `sample`、分配编辑、创建并发布第一版，随后由运维配置入口域名。编辑记录应包含原版本、新版本、恢复后的版本、耗时和需运维介入的步骤。

## 网关与镜像

按 [生产镜像指南](PRODUCTION_IMAGES.md) 从通过 CI 的同一提交取前后端镜像。生产 Django 显式配置下列 origin 白名单。普通开发设置在未提供变量时启用这两个内测域名，生产设置需要显式配置。

```dotenv
BOX_PRODUCT_PROFILE_ORIGINS={"https://box.test.edialect.top":"box","https://pxm.test.edialect.top":"pxm"}
```

网关把两个 HTTPS 域名的 H5 请求转到同一个 8080 前端容器，保留 history fallback。按现有部署规则将两个站点的业务 API 路径（含 `/site-settings/product-profile`）转到同一 8000 后端容器，保留原始 `Host`、由网关覆盖 `X-Forwarded-Proto: https`。后端只使用配置过的完整 origin。跨域访问共享 API 时使用浏览器的 `Origin`，同域请求可使用当前 Host。配置文件中的映射只控制公开资料展示，Django 会继续用原有权限规则处理业务请求。管理后台及其静态资源走既有管理入口。

使用 `VITE_BACKEND_URL=` 的同源发布镜像即可复用两站构建。该镜像的浏览器缓存按站点 origin 隔离，站点配置接口为 `no-store`。公共媒体仍使用部署方已配置的规范 URL。微信构建可用 `VITE_BOX_PRODUCT_PROFILE=pxm` 绑定已登记 profile。微信 AppID、合法域名和 OAuth 凭据仍由对应发行环境设置，需实机验证。不同 AppID 会话连续性也需单独验证。

## 隔离验证与回退

- 用既有发布流程备份 SQLite、持久化媒体、对象存储及网关配置，记录镜像 digest、提交、数据库备份时间和媒体恢复点。保留原始账户、贡献和权限，在隔离副本演练 `migrate`，无需导入演示库。验证 `siteconfig.0005_product_profiles` 只新增配置表及初始版本。
- 核对两站的首页、查词、词条、录音、账户、404、分享冷启动与登录返回。在浅色和暗色的手机宽度下复测。前端 E2E 运行方式见下方，匿名检查之外另需真实登录和录制授权验收。
- 运营内容故障可恢复到上一站点版本。如果两站品牌配置都需临时撤下，保留两个 origin 并将其映射改为 `general`，重启后端后复核。单纯移除 origin 会同时取消该 Host 的生产 API 准入。
- 应用回退优先使用上一个已验证 digest，保留已经扩展的数据库及新写入。回到只认一个 Host 的旧后端时，应一并还原原网关配置，先在隔离环境验证旧入口和新入口的转接安排。数据库恢复使用独立副本演练，恢复点之后的写入可能丢失。公共内测上线前另行验证备份恢复、真实认证、媒体读写、告警和资源余量。

## 本地双站检查

可以用本地 Traefik 将同一个前端服务关联到两个域名。示例在仓库根目录运行，测试库应独立于现有环境。

```sh
export TRAEFIK_FRONTEND_RULE='Host(`guantou.localhost`) || Host(`box.guantou.localhost`) || Host(`pxm.guantou.localhost`)'
export BOX_PRODUCT_PROFILE_ORIGINS='{"http://box.guantou.localhost":"box","http://pxm.guantou.localhost":"pxm"}'
docker compose -f docker-compose.traefik.yml up --build -d
cd frontend
E2E_BOX_PROFILE_URL=http://box.guantou.localhost \
E2E_PXM_PROFILE_URL=http://pxm.guantou.localhost \
E2E_GENERAL_PROFILE_URL=http://guantou.localhost \
E2E_PROFILE_API_URL=http://api.guantou.localhost \
  yarn test:e2e:h5 product-profile.spec.js
```
