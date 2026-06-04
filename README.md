# Hagihub

HagiCode 生态系统的桌面端入口，基于 Electron 构建。

## 技术栈

- **Electron** 41 — 桌面端运行时
- **React** 19 — UI 框架
- **Vite** 8 — 构建工具（renderer + preload）
- **TypeScript** 6 — 类型系统
- **Electron Forge** 7 — 打包与分发

## 项目结构

```
src/
  main/           # Electron 主进程
    bootstrap.ts  # 入口，加载 main.ts
    main.ts       # 窗口管理、IPC 注册
  preload/        # 预加载脚本（contextBridge）
    index.ts
  renderer/       # React 渲染进程
    App.tsx
    main.tsx
    index.html
    index.css
    global.d.ts
  shared/         # 主进程/渲染进程共享类型
    api.ts
scripts/          # 构建与打包脚本
resources/        # 图标、MSIX 模板、PSF 配置
.github/workflows/ # CI/CD
```

## 开发

```bash
npm install
npm run dev
```

启动开发模式：Vite dev server（renderer）+ tsc watch（main）+ vite build watch（preload）+ Electron。

## 构建

```bash
# 完整构建（类型检查 + 编译 + smoke test）
npm run build:prod

# 打包为平台安装包
npm run build:linux          # AppImage, DEB, RPM, tar.gz, ZIP
npm run build:win            # Portable, NSIS, MSIX
npm run build:mac            # DMG, ZIP

# 单独目标
npm run build:linux:appimage
npm run build:win:nsis
npm run build:mac:arm64:dmg
```

## CI/CD

- **PR Checks** — 类型检查 + 生产构建 + Linux 打包验证
- **Build** — 推送到 `main` 或创建 `v*` tag 时触发多平台构建
- **Release Drafter** — 自动草拟 release notes
- **Windows 签名** — 支持 Azure Artifact Signing
- **macOS 签名** — 支持 Apple notarization

## 发布

```bash
# 创建 tag 触发生产构建并发布
git tag v0.1.0
git push origin v0.1.0
```

## License

AGPL-3.0
