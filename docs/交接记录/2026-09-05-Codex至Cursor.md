# labu-loom：Codex 至 Cursor 交接记录

## 一、交接信息

- 交接日期：2026-09-05
- 来源：Codex
- 接收方：Cursor
- 仓库：`D:\workspace\labu-loom`
- 远程：`git@github.com:dengweiqiang22/labu-loom.git`
- 当前开发分支：`dev`
- 当前提交：`f26863e2bb463513df9231bbbb8339dd18953af8`
- 当前版本：`0.4.2`
- 当前标签：`v0.4.2`

本文件是一次状态快照。开始工作前仍须重新执行 `git status --short --branch`、`git log -1 --show-signature` 和版本检查。

## 二、开始工作前必须阅读

按以下顺序阅读：

1. 仓库根目录 `AGENTS.md`：对所有工具生效的最高层仓库协作约束。
2. `docs/产品规划.md`：产品定位、陪伴模式、阶段路线和明确不做的功能。
3. `docs/开发规范.md`：分支、验证、提交、版本和发布规则。
4. `docs/数据与隐私边界.md`：输入、聚合、记忆、日志和未来同步的红线。
5. `docs/任务计划-0.4回忆与体验.md`：当前阶段任务和验收标准。
6. `docs/问题记录.md`：Windows 已知问题、证据和当前处理结论。
7. `docs/发布与更新方案.md`：更新地址、签名和草稿 Release 流程。

不得只读本交接文件后直接开发。本文件不替代上述规范。

## 三、当前仓库与发布状态

### 3.1 Git 状态

- `dev`、`main`、`origin/dev` 和 `origin/main` 均指向 `f26863e`。
- `backup` 保持上游源项目基线 `44f44bc`，不得随开发分支移动。
- 当前检出 `dev`，与 `origin/dev` 同步。
- 接手前已经存在未跟踪的 `.cursorindexingignore` 和 `.specstory/`。它们不是 Codex 本次交接文档的内容，未经用户明确决定不得删除、覆盖或混入提交。
- 本次新增的 `docs/交接记录/` 文件在用户授权提交前保持未提交状态。

### 3.2 v0.4.2 发布状态

- 标签 `v0.4.2` 是 GPG 签名标签，指向 `f26863e`。
- GitHub Actions 运行 `33936152977` 已成功完成。
- GitHub 已生成 `labu-loom v0.4.2` 草稿 Release，当前不是预发布，也尚未正式发布。
- 草稿包含 Windows x64 安装包、对应 `.sig` 文件和 `latest.json`。
- 正式发布草稿、改写标签、删除 Release 或重新触发发布都属于远程写操作，必须获得用户明确授权。

## 四、最近完成的工作

### 4.1 0.4 回忆体验

- RE-01 / `0.4.0`：建立共同回忆只读展示模型。
- RE-02 / `0.4.1`：建立共同回忆和记忆管理双视图。
- 共同回忆只消费日、周、月聚合和结构化记忆，不创建派生持久化副本。

主要入口：

- `src/domain/memory/recollection.ts`
- `src/stores/memory.ts`
- `src/pages/preference/components/memory/index.vue`
- `tests/memory-recollection.test.ts`

### 4.2 BUG-01 / v0.4.2

问题：安装版 `0.3.7` 的主动互动入口可见，点击后入口消失，但没有显示选择气泡。

已确认根因：`src/pages/main/index.vue` 使用了 `InteractionBubble` 标签，却没有显式导入该 Vue 组件。运行时 DOM 中出现空的 `<interactionbubble>` 未知元素，互动状态本身正常打开。

修复：显式导入 `src/components/interaction-bubble/index.vue`，没有改动模型拖拽、窗口穿透或互动调度结构。

已完成的 Windows WebView2 实机验证：

- 点击入口后生成一个对话气泡。
- 气泡包含三个结构化选项。
- 关闭按钮正常结束互动并恢复入口。
- “暂时不回应”正常结束互动并恢复入口。
- 开发实例通过应用自身退出接口正常结束，没有强制终止原生进程。

提交：`f26863e fix(interaction): 修复主动互动气泡不显示`。

## 五、下一任务：RE-03 / v0.4.3

任务名称：生成宠物视角的自然总结。

### 5.1 验收边界

- 使用代码内置的固定模板和结构化参数生成自然表达。
- 简体中文、繁体中文、英文、葡萄牙文和越南文都要有明确文案。
- 完全本地运行，不请求在线模型或其他网络服务。
- 不接受或生成自由文字输入，不把最终渲染文案保存到 Store、日志或磁盘。
- 总结只能追溯到已有聚合统计或结构化记忆；数据清除后总结同步消失。
- 文案必须温和，不显示生产力评分、排名、完成率、连续打卡或负面评价。

### 5.2 建议实现入口

- 复用 `src/domain/memory/recollection.ts` 的 `RecollectionOverview`，不要另建重复聚合链路。
- 将模板选择保持为纯函数，建议在 `src/domain/memory/` 下建立独立模块并为分支选择、空数据和稳定输出补测试。
- 在 `src/pages/preference/components/memory/index.vue` 的共同回忆视图中展示结果。
- 文案键放入现有五份 `src/locales/*.json`，不要在业务函数中硬编码完整自然语言。
- 通过 `src/stores/memory.ts` 的既有计算属性消费即时派生结果，不新增持久化字段。

### 5.3 明确不做

- 不接入 OpenAI、在线大模型或任意在线文案服务。
- 不保存生成后的句子。
- 不读取应用名称、窗口标题、屏幕、文档、网页或剪贴板。
- 不顺便实现 RE-04 的连续工作动作、RE-05 的休息提醒或 RE-06 的多显示器修复。
- 不在没有迁移设计的情况下调整记忆 schema。

完成 RE-03 后版本应为 `0.4.3`，并新增 `docs/版本日志/v0.4.3.md`。后续 RE-04 至 RE-08 当前依次规划为 `0.4.4` 至 `0.4.8`。

## 六、产品和隐私红线

- 产品核心是低打扰桌面陪伴宠物，不是聊天机器人、效率工具、直播工具或通用创作平台。
- 不增加自由文字聊天、等级、经验、签到、强制任务或不照顾宠物的惩罚。
- 明确提醒必须由用户主动开启；安静模式不主动显示互动气泡。
- 官方角色保持稳定人格，只允许互动方式和陪伴节奏适应用户。
- 具体按键、按键序列、单次事件时间和完整鼠标轨迹只能短暂存在于内存，禁止持久化或写日志。
- 禁止读取或保存屏幕内容、窗口标题、应用名称、文档内容和剪贴板内容。
- 长期数据仅允许日/周/月聚合与整理后的结构化语义记忆。
- 新增持久化字段前必须说明目的、来源、粒度、保留周期、展示、删除、同步、迁移和回滚。
- 记忆必须继续支持查看、修改、单条忘记、分类清除和全部清除。
- 未来同步默认关闭；不得以当前任务为由提前接入云端。

## 七、分支、提交与授权约定

### 7.1 分支

- `dev`：默认日常开发分支。
- `main`：只接收已经验证的阶段成果，通常从 `dev` 使用 `git merge --ff-only dev` 更新。
- `backup`：源项目基线，未经用户明确要求不得修改、合并、重置或删除。

### 7.2 外部写操作

未经用户明确要求，不执行以下操作：

- `commit`
- `push`
- `merge` 或 `rebase`
- 创建、移动或删除标签
- 创建、发布、修改或删除 Release
- 修改远程仓库、Actions secrets、更新地址或签名方案

用户要求“开发”不自动等于授权提交和推送；用户明确说“提交并推送”“合并到 main”“创建标签并发布”时，才执行对应范围。

### 7.3 提交格式

使用 GPG 签名的 Conventional Commits。标题使用英文类型和可选范围，说明使用中文。正文至少包含“变更”和“验证”，“影响”按需填写。

```text
feat(memory): 增加宠物视角自然总结

变更：
- 增加基于共同回忆模型的本地固定模板总结
- 补齐五种语言并接入共同回忆页面

验证：
- 总结模型测试、ESLint 和前端生产构建通过
- Windows 开发实例展示与数据清除联动通过
```

禁止为了绕过 pinentry 擅自使用 `--no-gpg-sign`。若签名失败，应停止并报告。

## 八、版本与发布约定

- `1.0.0` 才是首个正式稳定版本；当前仍为 `0.x.y`。
- 正式版前，阶段或大功能提升次版本号，兼容性 Bug 修复提升修订号。
- 每个准备交付的功能或 Bug 修复都同步修改 `package.json`、`src-tauri/Cargo.toml` 和 `Cargo.lock` 中的项目版本。
- 纯文档或不影响产物的工程维护可以不提升版本。
- 每个待发布版本必须新增人工维护的 `docs/版本日志/vX.Y.Z.md`，不能直接用提交记录代替。
- 发布工作流只监听 `v*` 标签；单独推送分支不会触发 Windows Release。
- 正常发布顺序是：验证 `dev` → 用户授权 → 推送 `dev` → 快进合并并推送 `main` → 在 `main` 创建并验证 GPG 签名标签 → 推送标签。
- Actions 创建的是草稿 Release。是否正式发布草稿仍需用户明确决定。
- Tauri 更新签名使用 GitHub Repository secrets；本机私钥材料位于被忽略的 `.searet.env`，不得打开、提交、复制到交接文档或发送到聊天中。

## 九、开发环境与验证

### 9.1 固定工具版本

- Node.js：`24.16.0`
- pnpm：`11.19.0`
- Corepack：本机已验证 `0.35.0`
- Rust：Actions 使用 `1.95.0`
- Windows 是当前唯一必须完成实机验收的平台。

本机 Node 通过 fnm 激活，独立安装在 `C:\Program Files\nodejs` 的旧 Node 已卸载。若终端版本异常，先检查：

```powershell
node --version
node -p "process.version + '  ' + process.execPath"
corepack --version
corepack pnpm --version
where.exe node
```

### 9.2 常用命令

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm tauri dev
corepack pnpm lint
corepack pnpm build
cargo fmt --all -- --check
cargo check --workspace --locked
```

按改动范围运行相关 `pnpm test:*`。记忆或数据变更还要验证旧数据迁移、清除流程、日周月边界和磁盘隐私。

### 9.3 Windows 调试退出

必须按顺序退出：

1. 从 labu-loom 托盘菜单正常退出应用。
2. 确认 `labu-loom.exe` 已结束。
3. 最后在终端按 `Ctrl+C` 停止 Vite/Tauri 服务。

不要在原生进程仍运行时直接终止整个开发进程树。

## 十、已知问题与观察

### 10.1 WIN-01 CrashSender

微信输入法 `2.0.0.27` 会向开发实例加载 CrashRpt 组件。强制结束进程树时曾出现 `Error launching CrashSender.exe`。仓库中没有 CrashSender 或 CrashRpt 调用，现有证据指向微信输入法外部模块。当前不阻塞开发，也不在项目安装流程中复制或替换第三方文件。完整证据见 `docs/问题记录.md`。

### 10.2 Vite 开发首屏样式竞态

2026-09-05 的一次开发实例首次加载时，WebView2 中的 `/__uno.css` 只有 UnoCSS preflight，工具类尚未生成，导致布局尺寸异常；Vite 稳定后该地址已包含完整工具类，重新加载主 WebView 后恢复。生产构建 CSS 完整，v0.4.2 构建通过。

该现象尚未作为独立 Bug 修复。若再次出现，应记录启动顺序、Vite 输出和 `/__uno.css` 是否包含 `.relative`、`.absolute`、`.size-full`，不要直接归因于 Tauri 或模型加载。

### 10.3 前端主包体积

当前生产构建仍提示主 JavaScript 包超过 500 kB，约 1.5 MB、gzip 约 435 kB。构建成功，该问题计划在 RE-07 统一评估，不应在 RE-03 中顺手重构打包配置。

## 十一、完成工作后给 Codex 的回传要求

Cursor 完成本轮工作后，请在 `docs/交接记录/` 新建 `Cursor至Codex` 文档，不覆盖本文件，并明确记录：

- 最终分支、提交哈希、版本和标签。
- 工作区全部未提交文件，并区分 Cursor 修改、用户已有修改和工具生成文件。
- 每个修改文件的目的以及关键设计选择。
- 实际执行的测试、构建和 Windows 运行验证；未执行项必须说明原因。
- 数据结构、兼容性、隐私、性能、发布或回滚风险。
- 已执行的 push、merge、tag、Actions、Release 等远程写操作。
- 下一任务的准确编号、版本和建议入口。
- 任何与本交接记录不同的现状或用户新决策。

不要只写“开发完成”或粘贴 Git 提交列表。交接文档必须让接收方在不依赖聊天历史的情况下安全继续工作。
