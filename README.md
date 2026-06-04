# Hagihub

Hagihub 是一个基于 Electron 的多账号 GitHub 管理桌面应用，用来在同一工作区内切换多个 GitHub 身份、浏览个人仓库与组织仓库，并为后续的仓库协作与 AI 工作流提供统一入口。

当前版本已经支持：

- 通过 GitHub Device Flow 在浏览器中完成多账号登录
- 在多个 GitHub 账号之间切换当前活跃身份
- 拉取组织列表与仓库列表，并按归属方分组展示
- 将 GitHub access token 保留在 Electron 主进程，并使用 `safeStorage` 做本地加密存储（系统不支持时退化为明文加密模式）

## 技术栈

- **Electron** 41, 桌面端运行时
- **React** 19, UI 框架
- **Redux Toolkit / react-redux**, 渲染进程状态管理
- **i18next / react-i18next**, 简体中文与英语多语言支持
- **hagi18n**, YAML 翻译源管理、审计与生成
- **shadcn/ui + Tailwind CSS 4**, 基础组件与设计 token
- **Vite** 8, 构建工具（renderer + preload）
- **TypeScript** 6, 类型系统
- **Electron Forge** 7, 打包与分发

## 使用方式

### GitHub 授权流程

1. 在 `Workspace` 中点击“添加账号”。
2. 应用会向 GitHub 请求 Device Flow 授权码，并展示 `user_code`。
3. 点击“在浏览器中打开 GitHub”，在 GitHub 页面输入验证码并确认授权。
4. 授权完成后，Hagihub 会自动拉取账号信息，并把该账号设为当前活跃账号。

### 请求的权限范围

- 默认 scope 为 `repo,read:org`
- `repo`, 用于读取仓库数据，并为后续需要写入仓库数据的能力保留权限
- `read:org`, 用于读取组织列表和组织归属关系
- 如需调整授权范围，可通过 `HAGIHUB_GITHUB_SCOPE` 覆盖默认值

### 安全模型

- GitHub access token 只在 Electron 主进程内解密和使用，renderer 进程不会拿到原始 token。
- 本地账号数据保存在 `userData/github-accounts.json`。
- 默认使用 Electron `safeStorage` 进行操作系统级加密存储。
- 如果当前系统不可用 `safeStorage` 加密能力，应用会退化到明文加密模式，并在 UI 中标记该状态。

### 开发环境说明

应用内置生产环境 GitHub OAuth App `client_id`：`Ov23lifl4lJU94egKfAz`。

本地开发或切换到其他 OAuth App 时，可通过环境变量覆盖：

```bash
export HAGIHUB_GITHUB_CLIENT_ID="<your-github-oauth-client-id>"
export HAGIHUB_GITHUB_SCOPE="repo,read:org"
```

如果未设置 `HAGIHUB_GITHUB_CLIENT_ID`，应用会默认使用生产环境 `client_id`。

## 项目结构

```
src/
  main/           # Electron 主进程，负责窗口管理、GitHub Device Flow、Token 存储和 GitHub API 代理
    bootstrap.ts
    main.ts
    github-auth.ts
    github-api.ts
  preload/        # 预加载脚本（contextBridge）
    index.ts
  renderer/       # React 渲染进程
    App.tsx
    components/   # 应用壳与共享 UI 组件
    features/     # 按业务域组织的功能模块
      github/     # GitHub 账号管理、授权对话框、仓库列表组件
    lib/
    locales/
    main.tsx
    index.html
    index.css
    store/        # Redux Toolkit store 与 slices
    global.d.ts
  shared/         # 主进程/渲染进程共享类型
    api.ts
scripts/          # 构建、i18n 与 smoke test 脚本
resources/        # 图标、MSIX 模板、PSF 配置
.github/workflows/ # CI/CD
```

## 开发

```bash
npm install
npm run dev
```

启动开发模式：Vite dev server（renderer） + tsc watch（main） + vite build watch（preload） + Electron。

## 构建

```bash
# 类型检查
npm run build:tsc:check

# 完整构建（类型检查 + 编译 + smoke test）
npm run build:prod

# 打包为平台安装包
npm run build:linux
npm run build:win
npm run build:mac
```

## CI/CD

- **PR Checks**，类型检查 + 生产构建 + Linux 打包验证
- **Build**，推送到 `main` 或创建 `v*` tag 时触发多平台构建
- **Release Drafter**，自动草拟 release notes
- **Windows 签名**，支持 Azure Artifact Signing
- **macOS 签名**，支持 Apple notarization

## License

AGPL-3.0
