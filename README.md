# MinMax Helper

MiniMax 使用量监控桌面应用（Tauri + React）。支持阈值预警、后台定时检查、企业微信通知、语言切换、以及“恢复出厂设置”（清除缓存并退出应用）。

English introduction is provided after the Chinese section.

---

## 功能特性（中文）
- 使用量监控：显示当前使用量与状态颜色/图标
- 阈值预警：超过自定义阈值时发送系统通知与企业微信通知
- 后台定时检查：按分钟间隔触发检查（默认 30 分钟）
- 企业微信 Webhook 通知：可选配置
- 语言切换：中文/英文一键切换
- 测试通知：快速验证系统通知是否正常
- 恢复出厂设置：清理前端与 WebView 缓存、重置配置文件，并退出应用

## 技术栈
- 前端：React 18、Vite 5、Tailwind（vite 版）
- 桌面端：Tauri 2（Rust）

## 运行环境
- macOS（开发者偏好）
- Node.js 18+（推荐 20+）
- pnpm（依赖管理）
- Rust（Cargo，用于 Tauri 后端）

## 快速开始
```bash
# 安装依赖
pnpm install

# 本地前端开发（仅网页）
pnpm dev

# 桌面应用开发（Tauri）
pnpm dev:tauri
```

## 构建与检查
```bash
# 前端构建
pnpm build

# 桌面应用打包
pnpm build:tauri

# Rust 类型检查（在 src-tauri 目录执行）
cd src-tauri && cargo check
```

## 测试
- 项目包含 `tests/usage.spec.ts`（Playwright E2E），若需运行：
```bash
# 安装 Playwright（若未安装）
pnpm dlx playwright install

# 运行测试
pnpm test:e2e
```
说明：当前 package.json 未固定 Playwright 依赖，使用 `pnpm dlx` 安装浏览器运行时更轻量。

## 使用说明
- 打开应用后，点击右上角齿轮按钮进入“设置”
- 设置项：
  - 预警阈值（0~100）
  - 后台检查间隔（分钟）
  - 企业微信 Webhook（可选）
  - 语言切换（右上角按钮）
- 测试通知：用于快速验证系统通知通道
- 恢复出厂设置：
  - 在设置页点击“恢复出厂设置”按钮
  - 会弹出确认对话框，确认后会执行：
    - 清理本应用的 localStorage
    - 请求后端清理 WebView 缓存（localStorage / sessionStorage / IndexedDB / CacheStorage / Service Worker 注册 / 可见 Cookie）
    - 删除并重置配置文件 `~/.minmax-helper/config.json` 为默认值
    - 退出应用（下次启动即为干净默认状态）

## 配置持久化
- 配置文件路径：`~/.minmax-helper/config.json`
- 默认值：
  - warning_threshold: 90
  - check_interval: 30
  - wechat_work_webhook_url: ""
  - language: "zh"
- 前端在后端写入失败时，会降级将设置写入 `localStorage` 键：`minmax_settings`

## 常见问题
- 为什么恢复后仍感觉有缓存？
  - MinMax 外部页面加载在独立 WebView 中，其存储（如 IndexedDB、Cache、Service Worker 等）与本应用域不同。现在“恢复出厂设置”会同时清理两侧存储，并在最后退出应用，确保下次启动为干净状态。HttpOnly Cookie 无法通过 JS 删除，但退出应用后浏览器内核会重新初始化。

## 项目结构（关键文件）
- 前端入口：[src/main.tsx](src/main.tsx)
- 主界面与设置页逻辑：[src/App.tsx](src/App.tsx)
- 国际化文案与切换：[src/i18n.ts](src/i18n.ts)
- 组件：
  - 监控面板：[src/components/MonitorPanel.tsx](src/components/MonitorPanel.tsx)
  - 确认对话框（恢复出厂设置二次确认）：[src/components/ConfirmModal.tsx](src/components/ConfirmModal.tsx)
- 后端（Tauri）：
  - 命令与配置持久化：[src-tauri/src/lib.rs](src-tauri/src/lib.rs)
  - 权限配置：[src-tauri/capabilities/default.json](src-tauri/capabilities/default.json)

## 贡献
- 欢迎提交 Issue 或 PR
- 代码风格：TypeScript + React hooks，尽量保持日志与中文注释友好
- 依赖管理：使用 pnpm

## 许可证
- MIT（详见 Cargo.toml）

---

# MinMax Helper (English)

A desktop app (Tauri + React) for monitoring MiniMax usage. It supports threshold alerts, background scheduled checks, WeChat Work webhook notifications, language switching, and “Reset to Factory Settings” (clear caches and exit).

## Features
- Usage monitor with status color/icon
- Threshold alerts (system + WeChat Work)
- Background scheduled checks (interval in minutes, default 30)
- WeChat Work webhook (optional)
- Language switch (ZH/EN)
- Test notification
- Reset to factory settings: clear frontend & WebView caches, reset config file, and exit app

## Tech Stack
- Frontend: React 18, Vite 5, Tailwind (vite)
- Desktop: Tauri 2 (Rust)

## Requirements
- macOS preferred for development
- Node.js 18+ (20+ recommended)
- pnpm
- Rust (Cargo, for Tauri backend)

## Quick Start
```bash
pnpm install
pnpm dev           # web only
pnpm dev:tauri     # desktop app
```

## Build & Check
```bash
pnpm build
pnpm build:tauri
cd src-tauri && cargo check
```

## Tests
The repo has `tests/usage.spec.ts` (Playwright E2E). To run:
```bash
pnpm dlx playwright install
pnpm test:e2e
```
Note: Playwright is not pinned in devDependencies; `pnpm dlx` installs browser runtime on demand.

## Usage
- Click the gear icon to open Settings
- Configure:
  - Warning threshold (0–100)
  - Background check interval (minutes)
  - WeChat Work Webhook (optional)
  - Language switch (top-right button)
- Test Notification: quickly verify system notification
- Reset to Factory Settings:
  - Click the button in Settings, confirm in the modal
  - It will:
    - Clear the app’s localStorage
    - Ask backend to clear WebView storages (localStorage / sessionStorage / IndexedDB / CacheStorage / Service Worker registrations / visible Cookies)
    - Reset `~/.minmax-helper/config.json` to defaults
    - Exit the app (next start is clean)

## Persistence
- Config file: `~/.minmax-helper/config.json`
- Defaults:
  - warning_threshold: 90
  - check_interval: 30
  - wechat_work_webhook_url: ""
  - language: "zh"
- Frontend falls back to `localStorage` key `minmax_settings` when backend write fails.

## FAQ
- Why does it look like caches persist after reset?
  - The MiniMax external page runs in an isolated WebView; its storages are different from the app’s domain. The reset now clears both sides and exits the app, ensuring a clean start. HttpOnly cookies cannot be deleted via JS, but exiting reinitializes the browser engine state.

## Project Structure (Key Files)
- Frontend entry: `src/main.tsx`
- Main UI & settings: `src/App.tsx`
- i18n: `src/i18n.ts`
- Components:
  - Monitor panel: `src/components/MonitorPanel.tsx`
  - Confirm modal (reset confirmation): `src/components/ConfirmModal.tsx`
- Backend (Tauri):
  - Commands & config: `src-tauri/src/lib.rs`
  - Capabilities: `src-tauri/capabilities/default.json`

## Contributing
- Issues and PRs are welcome
- Code style: TypeScript + React hooks, keep logs and comments clear
- Package manager: pnpm

## License
- MIT

