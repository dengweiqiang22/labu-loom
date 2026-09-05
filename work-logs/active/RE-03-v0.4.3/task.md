# RE-03：生成宠物视角的自然总结

## 基本信息

- 目标版本：`0.4.3`
- 当前开发分支：`dev`
- 默认代码所有者：Cursor
- 验证所有者：Codex
- 状态：待验证

## 目标

基于现有共同回忆聚合模型，用本地固定模板生成温和、低打扰的宠物视角自然总结，并在共同回忆页面展示。

## 范围

- 复用 `src/domain/memory/recollection.ts` 的 `RecollectionOverview`，不建立第二套聚合链路。
- 将模板选择实现为纯函数，并覆盖空数据、主要分支和稳定输出测试。
- 在 `src/pages/preference/components/memory/index.vue` 的共同回忆视图展示结果。
- 为简体中文、繁体中文、英文、葡萄牙文和越南文提供明确文案。
- 同步版本到 `package.json`、`src-tauri/Cargo.toml` 和 `Cargo.lock`，新增 `docs/版本日志/v0.4.3.md`。

## 不做

- 不接入在线模型、在线文案服务或其他网络请求。
- 不接收自由文字输入，不保存最终渲染句子。
- 不读取应用名称、窗口标题、屏幕、文档、网页或剪贴板。
- 不实现 RE-04 连续工作动作、RE-05 休息提醒或 RE-06 多显示器处理。
- 不调整记忆 schema 或新增持久化字段。
- 不顺手处理前端主包体积警告。

## 验收标准

- [ ] 自然总结只依赖已有聚合统计或结构化记忆，完全本地生成。
- [ ] 五种语言均有明确且语义自然的文案，不在业务函数中硬编码完整句子。
- [ ] 空数据时不伪造经历；数据清除后总结同步消失。
- [ ] 文案不包含生产力评分、排名、完成率、连续打卡或负面评价。
- [ ] 生成结果不进入 Store 持久化、日志、数据库或同步队列。
- [ ] 相关单元测试、ESLint 和前端生产构建通过。
- [ ] Windows 开发实例中页面展示及清除联动通过。

## 建议入口

- `src/domain/memory/recollection.ts`
- `src/stores/memory.ts`
- `src/pages/preference/components/memory/index.vue`
- `src/locales/*.json`
- `tests/memory-recollection.test.ts`
- `docs/任务计划-0.4回忆与体验.md`

## 必须执行的验证

```powershell
corepack pnpm lint
corepack pnpm build
```

按实际测试脚本补充自然总结模型的单元测试。涉及 Windows 页面交互后，使用 `corepack pnpm tauri dev` 完成共同回忆展示和清除联动验收，并按项目约定正常退出开发实例。

## 隐私、兼容性与回滚

- 数据类型：只消费即时派生的聚合统计和结构化记忆；不新增采集或持久化。
- 展示与删除：总结随共同回忆即时计算；原数据被清除后结果同步消失。
- 同步范围：不新增同步数据。
- 兼容性：不得修改已有存储格式，无需迁移。
- 回滚：可回退总结纯函数、页面展示和语言键，不影响现有记忆数据。

## 交接要求

Cursor 完成开发后填写 `reports/cursor-implementation.md`，并向 `inbox/codex/` 写入带 `.ready` 标记的 `handoff` 消息，然后停止修改产品代码。Codex 验证后填写 `reports/codex-verification.md`，并向 `inbox/cursor/` 返回 `go` 或 `no-go` 消息。
