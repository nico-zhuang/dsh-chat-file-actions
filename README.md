# 对话文件操作 · DSH Chat File Actions

一个适用于 DeepSeek Harness 的轻量客户端插件：在已完成的对话回复下方，按需显示**本轮文件**按钮，集中处理本轮引用的本地文件。不会覆盖右键菜单，也不修改 DSH 本体。

> 目前针对 DeepSeek Harness **0.2.0-rc.2** 开发和测试。macOS 上提供「在 Finder 中显示」；其他平台显示「在文件管理器中显示」，实际能力取决于 DSH Host。

## 使用

当本轮的提问或回复包含本地 Markdown 文件链接（包括图片链接）或 `@path`、`@"path with spaces"` 文件引用时，回复的操作栏才出现小尺寸回形针图标和数量。点击后：

- **点文件名**：交给系统默认应用打开。
- **点文件夹图标**：在 Finder／文件管理器中定位。
- **点「更多」**：复制绝对路径、文件名或 Markdown 链接。

常态只显示文件名；如果存在同名文件，则额外显示各自的父目录。悬停可查看完整路径。列表有固定标题和**独立滚动区**，使用 DSH 的日夜主题色、原生线性图标与文件类型图标，键盘可访问。

## 安装

1. 从 [Releases](https://github.com/nico-zhuang/dsh-chat-file-actions/releases) 下载 `dsh-chat-file-actions-0.2.0.tgz`。
2. 在 DSH 插件管理器中安装该本地包并启用 **对话文件操作**。
3. 若管理器提示 `restart-required`，保存其他任务后**手动重启 DSH**；仅刷新页面不一定足够。

插件包也可从源码构建：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm pack --ignore-scripts
```

本仓库没有托管到 npm registry，`package.json` 保留 `private: true` 以避免误发布；GitHub Release 的 `.tgz` 是安装文件。禁用或移除插件会撤销操作栏插槽和样式，不会修改你的会话文件。

## 实现与边界

- 通过正式插槽 `conversation.chat.assistant-actions` 注册，在对应回复的 `messageId` 所属**单轮、单会话**中收集候选；没有候选就不显示按钮。
- 只解析明确的本地 Markdown 目的地和 `@文件`引用，不把普通文本、代码块、HTML 注释或工具输出中的裸文件名猜成链接。参考式链接和复杂嵌套 Markdown 语法暂不支持。
- 展开时使用所属 `sessionId` 调用 DSH 的 `workspaceFiles.stat` 验证文件和绝对路径；相对路径缺少本会话工作目录时拒绝解析。验证失败不会启用文件操作。
- 每轮最多展示前 **200** 个文件，触及上限时提示；最多 **6** 个验证请求并发。关闭弹层会取消未完成的请求。
- 打开与定位使用 DSH 已有的 `session.openWorkspacePath`，不执行 shell 命令；「打开」指系统默认应用，并非 DSH 侧栏预览。复制操作仅在点击后写入剪贴板。
- 自动测试模拟 React 和 Remote，不能代替各操作系统、各 DSH 版本的真实界面验收。发现兼容问题请在 GitHub Issues 提供 DSH 版本与复现步骤，勿公开私人文件路径、令牌或完整会话记录。

## 开发

源码入口为 `lib/client.js`（浏览器）和 `lib/index.js`（无额外命令权限的 Host 占位）；插件清单位于 `package.json`，配置层位于 `cordis.patch.yml`。测试在 `test/client.test.js`，覆盖无文件回复、多会话隔离、PDF/PPTX/JPG 链接解析、Finder、复制、坏文件、日夜主题 CSS、同名文件和长列表限流。

本项目为独立社区插件，与 DeepSeek Harness 官方无隶属关系。许可证见 [LICENSE](./LICENSE)。

---

## English

**DSH Chat File Actions** adds a small, conditional paperclip action beneath a completed DeepSeek Harness reply. It lists local files referenced in that user/assistant turn: click a filename to open it with the system default app, use the folder icon to reveal it, or expand **More** to copy its path, name, or Markdown link.

The compact panel follows DSH's light/dark theme and scrolls independently for large turns. Candidates are verified through the owning session's `workspaceFiles.stat`; up to 200 are shown with at most six concurrent checks. No native commands or custom Host routes are introduced. Download the `.tgz` from [Releases](https://github.com/nico-zhuang/dsh-chat-file-actions/releases), install it in the DSH plugin manager, and restart manually if requested. Tested against DSH 0.2.0-rc.2; this is an independent community plugin, not an official DeepSeek product.
