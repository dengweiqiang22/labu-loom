# labu-loom

> 基于 [BongoCat](https://github.com/ayangweb/BongoCat) 进行个人定制的 Windows 桌面陪伴宠物。

labu-loom 是一个独立维护的个人定制化项目，在 ayangweb 开发的开源项目 BongoCat 基础上继续演进。项目保留了 BongoCat 的核心桌面宠物能力、Live2D 模型支持和输入动作映射，并围绕个人长期使用需求，重新设计产品定位、隐私边界、Windows 体验和后续陪伴能力。

本项目不是 BongoCat 的官方版本，也不代表原作者的产品方向。感谢 BongoCat 作者和贡献者提供的开源基础；原项目许可证、版权声明和必要归属信息会持续保留。

## 与 BongoCat 的关系

labu-loom 直接基于 [ayangweb/BongoCat](https://github.com/ayangweb/BongoCat) 的代码开发。当前继承或继续使用的主要能力包括：

- 基于 Tauri、Vue 和 Rust 的桌面应用架构。
- Live2D 模型加载、导入和动作映射能力。
- 根据键盘、鼠标和手柄输入播放模型动作。
- 透明、置顶的桌面宠物窗口及托盘、偏好设置等基础体验。

在此基础上，labu-loom 已进行以下独立调整：

- 使用独立的产品名称、应用标识、数据目录、仓库和发布链路。
- 将 Windows 作为当前唯一必须完成实际验收的平台。
- 增加可持久化的键盘与鼠标监听开关，并在关闭时停止处理输入事件。
- 移除原项目的更新服务和发布配置，改用 labu-loom 自有的 GitHub Releases 与 Tauri 更新签名。
- 将产品方向从输入动作展示扩展为低打扰、可长期使用的桌面陪伴宠物。
- 建立明确的数据最小化和隐私边界，不持久化具体按键、输入内容或完整鼠标轨迹。

如果你需要 BongoCat 的原始功能、跨平台发行版本、社区资源或上游支持，请直接访问 [BongoCat 项目](https://github.com/ayangweb/BongoCat)。

## 产品定位

labu-loom 希望陪伴用户度过重复、安静或需要持续专注的工作时间。宠物通过自然动作、状态变化和低频互动形成陪伴感，而不是持续占用注意力。

项目遵循以下原则：

- 核心体验是桌面陪伴，不是聊天机器人或效率管理工具。
- 默认保持安静和低打扰，明确提醒必须由用户主动开启。
- 不增加等级、经验、签到、强制任务或惩罚机制。
- 核心动作反馈和陪伴能力应当能够离线运行。
- 用户可以暂停输入监听，并对未来的记忆数据拥有查看、修改和清除能力。

完整产品方向见 [产品规划](docs/产品规划.md)。

## 当前状态

项目当前处于 `0.1` 工程与产品基线阶段，已完成：

- labu-loom 品牌、应用标识和本地数据身份隔离。
- Node、pnpm 和 Rust 工具链版本固定。
- Windows 透明窗口、托盘、偏好设置和单实例行为验收。
- 键盘与鼠标监听的手动暂停和恢复。
- GitHub Releases、Tauri updater 和专用更新签名配置。
- Windows x64 NSIS 安装包的本地签名构建验证。

首个正式 GitHub Release 尚未发布。陪伴行为引擎、选择式互动、活动聚合和长期记忆仍属于后续版本规划，不应视为当前已实现功能。

## 数据与隐私

labu-loom 只处理实现桌面宠物反馈所必需的数据：

- 具体按键、按键序列、单次事件时间和完整鼠标轨迹只允许短暂存在于内存。
- 不读取或记录屏幕内容、窗口标题、应用名称、文档内容和剪贴板内容。
- 不将能够还原用户具体操作过程的原始输入事件写入磁盘。
- 未来的活动统计只保存聚合结果，记忆功能必须支持查看、修改、分类清除和全部清除。
- 未来同步功能必须默认关闭，并由用户主动开启。

详细约束见 [数据与隐私边界](docs/数据与隐私边界.md)。

## 本地开发

当前主要开发和验收环境为 Windows。

准备工具链：

- Node.js 24.16.0
- pnpm 11.19.0，通过 Corepack 使用
- Rust 1.95.0

安装依赖并启动：

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm tauri dev
```

基础检查：

```powershell
corepack pnpm lint
corepack pnpm build
cargo fmt --all -- --check
cargo check --workspace --locked
cargo test --workspace --locked
```

工程、分支、验证和提交规则见 [开发规范](docs/开发规范.md)。

## 发布与更新

labu-loom 使用自己的 GitHub Releases 和 Tauri updater 签名，与 BongoCat 的发布及更新服务相互独立。

- 正式仓库：[dengweiqiang22/labu-loom](https://github.com/dengweiqiang22/labu-loom)
- 当前目标产物：Windows x64 NSIS 安装包
- 更新方式：由用户在“关于软件”页面主动检查
- Windows Authenticode：当前尚未启用，安装包可能出现 SmartScreen 提示

发布流程和签名边界见 [发布与更新方案](docs/发布与更新方案.md)。

## 文档

- [产品规划](docs/产品规划.md)
- [开发规范](docs/开发规范.md)
- [数据与隐私边界](docs/数据与隐私边界.md)
- [0.1 项目基线任务计划](docs/任务计划-0.1项目基线.md)
- [发布与更新方案](docs/发布与更新方案.md)

## 开源归属与许可证

labu-loom 基于 [BongoCat](https://github.com/ayangweb/BongoCat) 修改和演进。BongoCat 的原始版权归原作者及贡献者所有：

```text
Copyright (c) 2025 ayangweb
```

本仓库继续遵循原项目的 MIT License。许可证全文见 [LICENSE](LICENSE)。使用、修改或再分发本项目时，请继续保留许可证要求的版权和许可声明。

BongoCat 的开发灵感来源还包括 [MMmmmoko/Bongo-Cat-Mver](https://github.com/MMmmmoko/Bongo-Cat-Mver)，相关创意与上游贡献同样值得感谢。
