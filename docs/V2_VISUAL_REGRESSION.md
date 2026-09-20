# V2 全站视觉回归清单

本清单对应 [#346](https://github.com/e-dialect/xiangsheng-box/issues/346)，用于在 V2 界面分支聚合后进行可重复的人工视觉巡检。当前 `frontend/src/pages.json` 注册 **33 个页面**；测试固定使用 390×844 视口，生成 **59 张截图**：33 个注册路由、4 个核心界面的 16 种主题/身份组合、“听”页的 4 种数据状态，以及 6 个主题次级旅程。

## 一键生成

在 `frontend/` 目录运行：

```bash
npm run review:visual:h5
```

默认使用 8011；若端口被其它任务占用，指定另一端口仍可保持单命令运行。仅本次巡检生效的 Vite 后置配置会以 strict-port 模式让服务和浏览器使用同一地址，不改写 `manifest.json`，也不会误连到另一任务：

```bash
VISUAL_REVIEW_BASE_URL=http://localhost:8012 npm run review:visual:h5
```

命令会自行启动 H5 服务，并将截图、机器可读清单和浏览用联系表写入：

- `output/playwright/v2-visual-review/index.html`
- `output/playwright/v2-visual-review/manifest.json`
- `output/playwright/v2-visual-review/{routes,core,states,themes}/`

这些均是本地验收产物，已加入 `.gitignore`。

总览页使用内联 SVG favicon，不依赖站点静态资源；通过本地 HTTP 打开时不应额外请求 `/favicon.ico`，因此巡检工具自身也不会给 console 门禁制造 404 噪声。

若 H5 已由外部服务启动，可显式复用：

```bash
VISUAL_REVIEW_EXTERNAL=1 \
VISUAL_REVIEW_BASE_URL=http://localhost:8011 \
npm run review:visual:h5
```

使用 `VISUAL_REVIEW_OUTPUT=/绝对路径` 可将本轮结果写到另一目录，适合保存两次运行并逐张比较同名文件。

## 覆盖与责任

路由表由 `frontend/tests/e2e/fixtures/visualReviewMatrix.js` 单点维护，单元测试会阻止新增页面漏入清单、页面重复映射或责任 Issue 缺失。

清单将 uni-app 注册路由与浏览器实际地址分开校验；例如注册页 `/pages/index` 在 H5 中的规范地址是 `/`，不会因此误报缺页。

| 范围 | 数量 | 责任 Issue |
| --- | ---: | --- |
| 首页“听” | 1 | #341 |
| 搜索、词条详情 | 2 | #342 |
| 录音创建 | 1 | #343 |
| “我”、引导、推荐关注、设置与登录注册 | 12 | #344 |
| 圈子列表/详情、公开用户页 | 3 | #355 |
| 站内信列表/详情/发送 | 3 | #356 / #398 |
| 整理工作台与申请 | 2 | #360 |
| 贡献履历与收藏 | 2 | #361 |
| 404 恢复页 | 1 | #362 |
| 主题中心、装扮、获取、会员与活动 | 5 | #262 / #264 |
| **注册页面合计** | **33** | — |

核心矩阵额外覆盖“听 / 查 / 录 / 我”在浅色、暗色与访客、登录用户组合下的 16 个首屏；访客进入“录”时以登录恢复页为预期结果。状态矩阵固定覆盖“听”页录音列表的 loading、empty、error、success 四态，主题旅程补充局部装扮、获取、会员与活动的暗色或边界状态。

成功夹具使用离线内嵌的 96×96 松绿色 SVG 头像，避免网络波动和透明占位图掩盖身份布局。“我的”注册路由样本则显式返回空头像并检查姓名首字回退；core mine 的登录用户变体继续检查正常图片分支。每张产物会在 `manifest.json` 记录 `avatarState`，便于区分这两种视觉责任。

## 审阅方法

1. 先打开 `index.html` 检查全站层级、间距、圆角、色彩和主要行动是否一致。
2. 再按相同文件名比较改动前后截图，重点检查结构漂移、暗色对比度、主按钮抢占、空错状态语义和长文本溢出。
3. 每个用例都会检查实际路由、非空页面、横向溢出不超过 2px，并在截图稳定后断言 console warning/error 与 page error 为空。
4. error 样本会故意返回 HTTP 503，因此只在该样本跳过严格 console 断言；它仍用于人工确认失败说明与重试入口。动态音频进度不作为像素级门禁，避免把时间变化误判为视觉回归。

如需比较 A/B 两轮，可分别设置 `VISUAL_REVIEW_OUTPUT`，然后并排打开两个联系表；变更责任以卡片中的 Issue 标签为准。

## 微信小程序待验

自动验收必须至少运行：

```bash
npm run build:mp-weixin
```

构建成功不等于真机通过。本轮未自动控制微信开发者工具或真机，合并前仍需在一台带刘海/灵动岛设备和一台常规安卓设备核对：顶部安全区、底部手势区、系统键盘顶起、录音与音频权限、原生弹层层级、浅暗主题跟随及返回栈。发现差异时在 #346 留设备、系统、页面和截图，不把真机缺口伪装成已验证。
