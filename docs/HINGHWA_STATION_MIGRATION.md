# 兴化语记 → 乡声集盒莆仙方言站迁移

## 1. 最终定位

“兴化语记”品牌保留，成为**乡声集盒的莆仙方言站点 / 旗舰地方馆**。老用户可以继续从熟悉的品牌、域名和小程序入口进入，但新功能与长期数据模型统一进入 `e-dialect/xiangsheng-box`。

## 2. 技术规则

- Legacy Maintenance → Migration → Cutover → Archive。
- 当前阶段**不 archive**三个旧 `hinghwa-dict-*` 仓库。
- 旧仓库只接受安全、数据完整性、迁移阻塞和严重线上故障修复。
- 不在旧架构新增普通产品 feature。
- 数据只允许 Legacy → 乡声集盒单向迁移，不做双向同步。
- 不恢复 Can / Nameplate 等旧领域模型。
- 优先复用已有 `import_hinghwa_legacy`，不创建第二套平行导入器。

## 3. 账号

最终以乡声集盒统一身份为主要登录主体；兴化语记独立身份只作为迁移期兼容来源。

账号 cutover 必须单独 rehearsal，验证：

- 同手机号/同主体映射；
- 管理员与普通用户权限；
- session/JWT 失效与重新登录；
- 贡献关系、积分等历史信息；
- 冲突账号人工核对清单。

生产身份 cutover 属于 maintainer 最终决策，不由普通实现 Issue 自动执行。

## 4. 数据 cutover

正式切换前必须完成：

1. 生产副本 dry-run；
2. 旧 ID → Entry / Recording 映射导出；
3. 数据计数与抽样；
4. Evidence / 原始地区 / 可见性核对；
5. 搜索与关键页面抽样；
6. 账号抽样登录；
7. migration report 留档；
8. 回滚点与变更窗口。

## 5. 用户侧连续性

Experience Track 负责：

- 莆仙站首页 / ProductProfile；
- 旧 URL → 新用户旅程映射；
- 分享链接兼容与自然落地；
- 老用户 onboarding；
- 小程序与 `hinghwa.cn` cutover；
- 迁移后的“仍然是兴化语记”品牌连续感。

## 6. 旧能力盘点

`semantic search / quiz / AudioCompare / article / music / rewards` 不直接照搬。逐项给出：

- move to core
- generalize
- hinghwa-only content
- retire

四选一结论及证据。

## 7. Archive 条件

只有当主要数据、账号、入口、旧链接和运行依赖都完成 cutover，并且至少经过一轮稳定运行观察后，才由 maintainer 决定 archive 旧仓库。
