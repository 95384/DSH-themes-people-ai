# people-ai（人民的AI）

当前版本：V0.1.0

DeepSeek Harness Web 的固定壁纸插件。把 Web 界面的应用背景替换为一张固定的壁纸图片，界面刷新后壁纸保持为同一张图片，不再变化；插件加载期间同时锁定深色主题，禁用自带的外观切换。

## 功能

- 壁纸图片随项目打包（`assets/background.jpg`），不依赖外部路径。
- Host 通过 harness 的 WebServer 提供同源图片路由 `GET /people-ai/wallpaper.jpg`，浏览器直接以 CSS `url()` 加载，无 CORS、无 base64 传输。
- Client 注入根背景样式，并通过官方 `theme.overrideTokens` 把基底 token `--dsw-alias-bg-base` 覆盖为半透明底色（主区域保留底色、壁纸透出），侧边栏 token `--dsw-specific-sidebar-fill` 覆盖为半透明。
- 抬升表面（`--dsw-alias-bg-layer-*`）保持不透明，卡片内容可读。
- **输入框毛玻璃**：消息输入卡片（composer，官方稳定 `data-composer-card` 钩子）覆盖为半透明底色 + `backdrop-filter: blur(1px)`，壁纸在输入框后透出。
- **设置面板毛玻璃**：设置对话框（`role="dialog"` 且内含官方 `data-slot="settings.section"` 内容座位，`:has()` 精确定位、不误伤其他对话框）覆盖为半透明底色 + 轻微模糊。
- **深色锁定**：加载时强制 `setTheme('dark')`，监听 `theme/change` 把任何非深色切换弹回，并把设置面板"外观"行替换为只读锁定提示；卸载时恢复之前的主题偏好。
- **新会话标题改名**：创建新会话界面的"探索未至之境"标题替换为"人民的AI"（英文界面同步替换 "Into the Unknown"）。
- 样式标签、token 覆盖层、事件监听与设置行替换均由插件 Fiber 管理，卸载时自动移除。

## 工作原理

- `lib/index.js` 注入 `webServer`，注册 `GET /people-ai/wallpaper.jpg`（仅允许 GET，其余返回 405）。
- 壁纸以 `import.meta.url` 相对本模块解析包内 `assets/background.jpg`，任何安装方式（本地链接或发布副本）均可定位；可选覆盖：`$PEOPLE_AI_WALLPAPER_PATH` 环境变量优先于包内图片。
- 图片字节在首次请求时读取并缓存于插件 Fiber 内，路由与缓存随插件停止自动清理。
- `lib/client.js` 向 `document.head` 插入一个 `style` 标签（选择器 `html,body`，通用根选择器，不使用产品哈希类名），并把 `--dsw-alias-bg-base` 覆盖为半透明底色、`--dsw-specific-sidebar-fill` 覆盖为半透明（数值见源码注释，可自行微调 alpha）。
- 输入框毛玻璃通过官方稳定 data 属性钩子 `[data-composer-card]` 定位（非哈希类名），半透明背景 + `backdrop-filter: blur(1px)`；模糊半径与透明度见源码注释。
- 设置面板毛玻璃通过 `[role="dialog"]:has([data-slot="settings.section"])` 定位（官方无障碍角色 + 官方 slot 数据属性，`:has()` 仅命中设置对话框）；半透明底色 + 1px 模糊，并叠加 1px 主题边框光晕（`box-shadow: 0 0 0 1px var(--dsw-alias-border-l3)`）与加强投影，保证面板边缘与周围对比清晰；透明度、模糊与光晕数值见源码注释。
- 新会话标题：官方 locale 字典不可补丁（同命名空间重复注册会抛错）且标题无 Slot 座位，故按**精确文本匹配**在 DOM 中替换（不依赖类名/选择器），MutationObserver 只处理新增与变化的节点（避免流式输出下的全量扫描），卸载时恢复原文本。
- 深色锁定分三层：初始化 `setTheme('dark')` → `theme/change` 弹回兜底（覆盖所有切换路径）→ shadow 官方 `settings.general.item` 的 `appearance` 条目（同 id、priority -1，slots 机制允许的低优先级替换），渲染只读"深色主题（由 people-ai 锁定）"行。
- 客户端样式、token 覆盖与 slot 替换均不依赖任何内部 DOM 结构，符合 Harness 客户端插件契约。

## 环境要求

- DeepSeek Harness `0.1.0-rc.6` 同系列版本。
- 已初始化 `web` profile，并可打开默认地址 `http://127.0.0.1:3080`。
- `dsh plugin` 使用的 `pnpm` 已在 PATH 中（当前环境已确认：node v24 / pnpm 11）。

## 安装

支持两种安装方式，任选其一。

### 方式一：本地源码安装（推荐，本机开发）

在项目根目录执行：

```powershell
dsh plugin --profile web add .
```

本地安装以链接方式指向源码目录，修改源码后重启 `dsh web` 即可生效；**本地目录需保留**。

### 方式二：在线安装

把项目发布为 GitHub 仓库后：

```powershell
dsh plugin --profile web add github:<owner>/people-ai
```

### 通用说明

本包声明了 `dsh.bundle`，安装成功后会自动加入 profile 的 bundle 层并写入 Loader 条目，无需手动编辑 `cordis.patch.yml`。重启 `dsh web` 并刷新浏览器后生效。

### 配置壁纸路径

默认使用包内 `assets/background.jpg`。需要换图时，直接替换该文件（保持文件名）即可；也可以设置环境变量指定其他路径（优先于包内图片）：

```powershell
$env:PEOPLE_AI_WALLPAPER_PATH = "D:\pictures\my-wallpaper.jpg"
```

## 验证

- 访问 `http://127.0.0.1:3080/people-ai/wallpaper.jpg`，返回图片本体；非 GET 请求返回 405。
- 浏览器中刷新页面后，应用背景显示固定壁纸；主窗口与侧边栏呈现半透明底色，消息卡片保持原有底色。
- 设置 → 常规 → 外观 显示"深色主题（由 people-ai 锁定）"，无法切换浅色/跟随系统；整个界面为深色主题。
- 在浏览器 Network 面板确认该图片请求来自同源 `/people-ai/wallpaper.jpg`。

## 卸载

```powershell
dsh plugin --profile web remove people-ai
```

bundle 层会随依赖移除自动清理，无需手动编辑 `cordis.patch.yml`。最后重启 `dsh web` 并刷新浏览器。壁纸图片随包删除，如需保留请自行备份。

## 开发与验证

本项目没有构建步骤，生产入口直接位于 `lib/`。修改后可执行测试与语法检查：

```powershell
npm test
node --check lib/index.js
node --check lib/client.js
npm pack --dry-run
```

测试覆盖浏览器 bundle 的样式标签插入契约与 `theme.overrideTokens` 调用（source、light/dark 值）。

Host 或 Loader 条目变化需要重启 `dsh web`。浏览器 bundle 更新后建议硬刷新，确保旧脚本缓存被替换。

## 兼容性与限制

- 插件只支持 Web surface，不适用于 headless 或 TUI profile。
- 壁纸为固定图片（不跟随亮/暗主题切换）；如需按主题区分，可扩展 `overrideTokens` 之外的 CSS 变量方案。
- 基底半透明化会让所有使用 `--dsw-alias-bg-base` 的表面透出壁纸（会话画布、设置面板等），透明度数值在 `lib/client.js` 中定义，可按观感自行调整；如不需要侧边栏透出，删掉 `--dsw-specific-sidebar-fill` 覆盖即可。
- 深色锁定期间 `setTheme` 会写入用户设置（`settings.theme.preference`）。**启用/禁用语义**：插件加载（启用）时临时锁定深色并禁用官方外观切换；插件禁用/移除时，Fiber 卸载自动恢复之前的主题偏好、移除外观行 shadow 与 hero 标题替换，官方主题管理与外观切换立即回归（无需重启）。仅"禁用后重启 harness"这一路径没有卸载回调，此时官方外观行已恢复可切换，但上次锁定时写入的 `dark` 偏好保留在设置中，手动切回即可。若 harness 未来版本改动外观行的 id/priority，锁定提示行可能失效，但 `theme/change` 弹回兜底仍保证深色强制生效。
- Host/Client 插件接口与 Harness `0.1.0-rc.6` 对齐，升级 Harness 后应重新验证路由与背景效果。

## 目录结构

```text
.
|-- README.md
|-- LICENSE
|-- package.json
|-- cordis.patch.yml
|-- assets/
|   \-- background.jpg
|-- lib/
|   |-- index.js
|   \-- client.js
\-- test/
    \-- client.test.js
```

## 许可证

MIT，详见 `LICENSE`。
