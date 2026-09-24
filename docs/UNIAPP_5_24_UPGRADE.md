# UniApp 5.24 成组升级记录

更新时间：2026-09-24；跟踪 Issue：#353。文件名保留 5.24 是因为它记录了那次成组升级的决策口径，当前生效批次见下方「锁定矩阵」。

## 决策

本次采用 DCloud 官方 Vue 3 Vite 模板的正式 5.24 批次 `3.0.0-5020420260813003`，不追随 npm `vue3` 标签上的后续 alpha。官方 CLI 文档建议通过版本管理或模板升级整批 CLI 依赖；因此所有 DCloud 编译器、运行时和目标平台包一次性对齐，不混用 4.08、5.01、5.02 与 5.24。

参考：

- [DCloud uni-app CLI 工程文档](https://en.uniapp.dcloud.io/quickstart-cli.html)
- [DCloud 官方 Vue 3 Vite 模板 package.json](https://github.com/dcloudio/uni-preset-vue/blob/6085e2034de05a4aff527687cbfe517bd0855b63/package.json)
- [HBuilderX 5.24 更新记录](https://download1.dcloud.net.cn/hbuilderx/changelog/5.24.2026081301.html)

## 锁定矩阵

| 分组 | 版本 |
| --- | --- |
| `@dcloudio/uni-*` 编译器与平台包 | `3.0.0-5020620260917001`（5.26 批次，见下文） |
| `@dcloudio/types` | `3.4.31` |
| Vue / runtime-core / compiler-dom | `3.4.21` |
| Vite / `@vitejs/plugin-vue` | `5.2.8` / `5.2.4` |
| Rollup | `4.14.3` |

Vitest 2.1.9 与 vite-node 接受 Vite `^5.0.0`，Vite 5.2.8 接受 Rollup `^4.13.0`。`package.json` 的 `resolutions` 将这些传递依赖也固定到上表版本，避免开发构建和单测各自加载不同的 Vite/Rollup。

`@dcloudio/uni-ui` 是独立 UI 组件库，不属于编译器批次，保留既有兼容范围。

## 安装环境

项目与 CI 使用 Node 22。当前锁文件里的 `jsdom@30.0.1` 要求 Node `^22.22.2`、`^24.15.0` 或 `>=26`，因此本机 Node 24.11 不能重新安装；本次使用 Node 24.19 和 Yarn 1.22.19 生成并验证锁文件。`yarn install --frozen-lockfile` 可复现安装。

安装日志剩余两类非矩阵告警：Yarn 1 自身调用 `url.parse()`，以及官方 `uni-automator` 声明但本项目不使用的 Jest 27 peer。它们不代表 H5 或小程序运行时加载了第二套 Vue/Vite。

## 上游限制

正式 5.24 在 H5 和微信小程序构建中仍通过 Vue SFC 适配层调用 Sass legacy JS API。移除 `silenceDeprecations: ['legacy-js-api']` 后，H5 告警门禁能稳定复现四条上游弃用提示；项目自身 Sass 已使用模块 API。因此本轮保留这一条精确静默，待后续正式编译器不再调用旧接口时删除，不能把“升级完成”误写成“上游问题消失”。

## 回归结论

- `yarn lint` 通过。
- 完整单测通过：51 个文件、360 项测试。
- H5 与微信小程序 checked build 通过，编译器均报告 5.24；版本更新提示不再出现，对应允许规则已删除。
- 完整 H5 E2E 通过：26 项，单 worker，390×844 viewport。
- 390×844 搜索页浅色和暗色人工检查布局一致，未见字体、间距或对比度回归。
- 产物体积、哈希和上游 CSS 差异记录在 [`BUILD_WARNINGS.md`](BUILD_WARNINGS.md)。

单测中的 `scroll-view` stub 告警由 #354 跟踪；浏览器里的 `setBackgroundColor` / `getMenuButtonBoundingClientRect` H5 兼容告警由 #350 跟踪，均已在各自隔离分支处理，不混入本次依赖升级提交。

## 5.26 批次对齐（2026-09-24）

DCloud 于 2026-09-18 发布正式批次 `3.0.0-5020620260917001`（`@dcloudio/uni-h5` 的 npm 发布时间 2026-09-18T02:05:11Z，对应 HBuilderX 5.26.2026091802）。它是 `3.0.0-*` 线上最新的**非 alpha** 批次；更新的 `3.0.0-alpha-5020720260921001` 只在 `vue3` 标签上，仍按本文件的决策不追。因此沿用同一口径：20 个 `@dcloudio/*` 编译器、运行时与目标平台 pin 一次性对齐，不逐包 bump。

逐包 bump 会让同一张锁文件里同时存在两套 `uni-shared`、`uni-mp-vue`、`uni-cli-shared`、`uni-mp-compiler`、`uni-mp-vite`、`uni-i18n`，这正是本批次改动要消除的状态。

回归结果（同一提交、同一依赖树基线，仅批次号不同）：

- `yarn lint`、`yarn test:unit` 与基线一致：80 个文件、532 项测试全绿（基线同为 80/532，本文上方 5.24 一节的 51 文件 / 360 项是 09-05 的规模）。
- `yarn build:h5:checked` 与 `yarn build:mp-weixin:checked` 通过，编译器报告 `5.26（vue3）`，`tracked notices: none`。同一基线树在本机连跑两次均在 `有新版本发布` 上退出 1，见 [`BUILD_WARNINGS.md`](BUILD_WARNINGS.md)。
- 产物形状不变：H5 134 个文件、微信小程序 459 个文件，两侧文件清单逐一对应，无新增或删除产物。
- 样式零漂移：H5 的 5 个业务 `index-*.css` 与微信小程序 `app.wxss` 的 SHA-1 与基线完全相同；唯一 CSS 变化是上游 `uni.css` 新增 `uni-rich-text[selectable=true]{user-select:text}` 一条，项目 `src/` 内 `rich-text` 零引用。
- H5 的 74 个内容有差异的产物里，JS chunk 逐个字节数不变，差异只在彼此引用的文件名哈希（哈希级联），`index.html` 随引用更新；微信小程序仅 `common/vendor.js` 增加 404 字节，是 DCloud 运行时自身的变化，业务 `wxml/wxss/json` 全部逐字节一致。

安装环境补记：本机仍是 Node 24.11 + Yarn 1.22.19，`jsdom@30.0.1` 与 `nopt@10.0.1` 的 engine 要求未被满足，因此锁文件用 `yarn install --ignore-engines` 再生成。该 flag 不改变解析结果：在未改动的基线树上跑同一条命令，锁文件零漂移；改动后的锁文件通过 `yarn install --frozen-lockfile`（CI 用的那条）且不被改写。`integrity` 逐条与升级前对应的 5.26 tarball 一致，`resolved` 主机名保持基线写法，锁文件差异因此收敛为 260 增 / 260 删且全部落在 `@dcloudio/*` 条目内。

H5 E2E 未在本地跑：CI 的那条 job 依赖 `docker compose up -d` 起后端与静态站点，本机启动会与既有栈争用 8181/8000 端口，改由 CI 的 H5 E2E 覆盖。
