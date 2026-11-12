# 词条与乡音分享

[#426 的原型和信息契约](https://github.com/e-dialect/xiangsheng-box/issues/426)定义了分享对象、卡片优先级和失效状态。两个示例分别展示[词条](https://github.com/user-attachments/files/33361035/index2.html)和[录音](https://github.com/user-attachments/files/33361049/index3.html)。

| 对象 | 微信原生卡片标题 | H5 和微信好友落地路由 | 到达后 |
| --- | --- | --- | --- |
| 词条 | 词条｜写法 · 大意 · 自然地区名 | `/pages/entries/details?id=<id>` | 看释义和读音。有录音时可主动播放，没有录音时可补一段。 |
| 录音 | 乡音｜录音大意 · 自然地区名 | `/pages/recordings/details?id=<id>` | 查看语境，主动播放这段录音。 |

H5 支持系统分享时打开分享面板，其他浏览器复制带部署路径的链接。微信好友卡片携带小程序页面路径，右上角菜单的朋友圈分享携带同一页面的 `id` 参数。卡片用固定品牌封面。标题取对象的公开字段，缺少自然地区名时写「地区待补充」，缺少词条写法时用大意识别。

详情读取完成且对象可公开分享时，才提供分享按钮和微信菜单。历史链接按服务端当前可见性读取。无法读取时可重试或返回。

原生 App 构建时用 `VITE_BOX_SHARE_WEB_URL` 指定同一数据环境的 HTTPS 网页地址，可包含部署路径。App 调用 `uni.shareWithSystem` 分享网页链接，系统调用失败时可复制。这个配置同时用于查词结果分享。未配置地址的原生包隐藏入口。
