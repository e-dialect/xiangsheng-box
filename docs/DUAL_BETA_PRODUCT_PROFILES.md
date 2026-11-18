# H5 双站内测与站点版本

`box.test.edialect.top` 的产品名是「乡声集盒内测版」，默认查词不限地区。`pxm.test.edialect.top` 的产品名是「兴化语记 2.0 内测版」，署名 `powered by 乡声集盒`，默认查词范围为「闽.莆仙」及其下级。两个站点使用同一份 H5 构建、同一套账户及业务 API。明确切站会保留公开词条、录音、集盒以及查词条件。浏览器按域名隔离登录态，换站后可用同一账户重新登录。分享链接使用发起页面的域名，登录完成或取消后留在发起站点。

## 运营预览、发布和恢复

1. 系统管理员通过 Django 后台的「产品站点」为编辑分配该站点，并授予该账户 `siteconfig` 的站点版本查看、新增和修改权限。该账户需能登录后台。检查编辑只能看到已分配的站点。
2. 打开「站点版本」，从线上版本的「预览和发布」页面点「复制为新草稿」。按行配置精选，例如 `词条 123`、`录音 45`、`集盒 6`，编号来自已公开内容的页面链接。最多 12 条，按行序展示。通用站可用同一方式推荐莆仙词条、录音和集盒。
3. 在「首页栏目」逐行填要展示的栏目，行序就是首页顺序。可选地方工具、混合精选、精选词条、精选乡音、集盒／专题。混合精选保留原精选顺序，和分类栏目二选一。空栏目或没有公开内容的栏目不占首页空间。
4. 勾选要启用的拼音方案、聪明花开或亲戚计算器。取消勾选会移除本站的工具入口，该站深链也会显示暂未启用。地方工具栏目移除时，已启用的工具仍可通过相关页面或链接进入。「地方工具方言限定码」可留空，访客可自行选择莆仙等方言。工具资料包另有发布流程。
5. 保存草稿，打开「预览和发布」，核对品牌、查词范围、栏目顺序、启用的工具和公开精选。点击「发布此版本」，然后以访客身份刷新该站点首页验证。已发布版本保留在历史中，选中历史版本可点击「恢复此版本」。后台操作日志记录发布和恢复者。

被撤下、删除或转为非公开的精选会从当前首页消失。恢复旧版时，若旧版仍引用现已不可发布的资料，可复制为草稿、去掉该引用后重新发布。旧版本内容和全局公告轮播配置各自留存。

中性站复用演练可以注册新标识 `sample`、分配编辑、创建并发布第一版，随后由运维配置入口域名。编辑记录应包含原版本、新版本、恢复后的版本、耗时和需运维介入的步骤。

## 网关与镜像

按 [生产镜像指南](PRODUCTION_IMAGES.md) 从通过 CI 的同一提交取前后端镜像。生产 Django 显式配置下列 origin 白名单。普通开发设置在未提供变量时启用这两个内测域名，生产设置需要显式配置。

```dotenv
BOX_PRODUCT_PROFILE_ORIGINS={"https://box.test.edialect.top":"box","https://pxm.test.edialect.top":"pxm"}
```

网关把两个 HTTPS 域名的 H5 请求转到同一个 8080 前端容器，保留 history fallback。按现有部署规则将两个站点的业务 API 路径（含 `/site-settings/product-profile`）转到同一 8000 后端容器，保留原始 `Host`、由网关覆盖 `X-Forwarded-Proto: https`。后端只使用配置过的完整 origin。跨域访问共享 API 时使用浏览器的 `Origin`，同域请求可使用当前 Host。配置文件中的映射只控制公开资料展示，Django 会继续用原有权限规则处理业务请求。管理后台及其静态资源走既有管理入口。

使用 `VITE_BACKEND_URL=` 的同源发布镜像即可复用两站构建。该镜像的浏览器缓存按站点 origin 隔离，站点配置接口为 `no-store`。公共媒体仍使用部署方已配置的规范 URL。微信构建可用 `VITE_BOX_PRODUCT_PROFILE=pxm` 绑定已登记 profile。微信 AppID、合法域名和 OAuth 凭据仍由对应发行环境设置，需实机验证。不同 AppID 会话连续性也需单独验证。

### K3s 双站入口

[双域 IngressRoute](../deploy/beta/ingress.yaml) 交给提供这批内测的命名空间。它要求同命名空间内有 `frontend:8080` 与 `backend:8000` 两个 Ready Service，两个域名使用同一份 H5 和同一套内测库。部署配置中使用上面的双域映射、稳定的 HTTPS `PUBLIC_BACKEND_URL` 和持久化的 SQLite。受控录音的二进制及授权关系保存在 SQLite，历史媒体继续使用原媒体卷或对象存储。

命名空间由值班人核对 Service、PVC 和运行环境后指定。以下两条命令预览资源，`diff` 返回 1 表示有变更。

```sh
kubectl --context taju-yl -n "${BETA_NAMESPACE:?指定已核对的内测命名空间}" apply --dry-run=server -f deploy/beta/ingress.yaml
kubectl --context taju-yl -n "$BETA_NAMESPACE" diff -f deploy/beta/ingress.yaml
```

公网路由使用 `edialect-public/websecure` 和现有 `tencentcloud` resolver。两个 Host 共用三条有优先级的规则。H5 的分享封面和图标许可文件交给前端，其余 `/static/`（含后台静态资源）、`/local-tools/`、`/files/recording-media/` 和既有 API 交给 Django。词条分享深链与旧兴化语记页面交给前端 history fallback。应用清单前留存既有兴化测试 Web 路由、优先级和 resolver；默认旧 Host 规则保留时，新 H5 的优先级 60 可接管，原兴化测试 API 域名独立运行。

`python3 scripts/check-dual-beta-ingress.py` 从公网检查两个默认 HTTPS 域名。隔离入口可通过 `--box`、`--pxm` 指定。探针只发起匿名 GET，验证域名对应的站点配置与切站链接、查词深链、两站入口 JS 哈希、实际 PNG 分享图、地方工具 JSON，以及随机不存在的音频是否收到不可缓存的 API 404。它会输出两站入口文件的 SHA-256 供发布记录使用。已录制、待审和撤回音频需要用投稿人、审核人及访客在同一网关另行验收。

## 隔离验证与回退

- 用既有发布流程备份 SQLite、持久化媒体、对象存储及网关配置，记录镜像 digest、提交、数据库备份时间和媒体恢复点。保留原始账户、贡献和权限，在隔离副本演练 `migrate`，无需导入演示库。验证 `siteconfig.0005_product_profiles` 新增配置表及初始版本，并核对 `0006_profile_home_layout` 为旧版本补齐「地方工具、混合精选」及原有三种工具的默认配置。
- 核对两站的首页、查词、词条、录音、账户、404、分享冷启动与登录返回。在浅色和暗色的手机宽度下复测。前端 E2E 运行方式见下方，匿名检查之外另需真实登录和录制授权验收。
- 运营内容故障可恢复到上一站点版本。如果两站品牌配置都需临时撤下，保留两个 origin 并将其映射改为 `general`，重启后端后复核。单纯移除 origin 会同时取消该 Host 的生产 API 准入。
- 应用回退优先使用上一个已验证 digest，保留已经扩展的数据库及新写入。回到只认一个 Host 的旧后端时，应一并还原原网关配置，先在隔离环境验证旧入口和新入口的转接安排。数据库恢复使用独立副本演练，恢复点之后的写入可能丢失。公共内测上线前另行验证备份恢复、真实认证、媒体读写、告警和资源余量。

回退到双站版本以前时，旧版写接口沿用原来的录音公开策略。保留当前数据库与媒体并暂停投稿，先将流量恢复到经过验证的只读入口，再使用包含授权审核的版本恢复投稿。切回旧兴化测试 Web 只切换浏览入口。真实备份应在隔离副本核对恢复点、SQLite 完整性及外键、既有录音的媒体和授权、恢复点后的投稿。新录音保存在新表，向下迁移会删除表及录音数据。

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
