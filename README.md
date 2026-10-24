# Hagihub

[![license](https://img.shields.io/badge/license-Apache--2.0-ffd43b)](./LICENSE)
[![build](https://img.shields.io/github/actions/workflow/status/HagiCode-org/Hagihub/build.yml?branch=main&label=build)](https://github.com/HagiCode-org/Hagihub/actions/workflows/build.yml)

Hagihub 是一个基于 Electron 的多账号 GitHub 管理桌面应用，用来在同一工作区内切换多个 GitHub 身份、浏览个人仓库与组织仓库，并为后续的仓库协作与 AI 工作流提供统一入口。

当前版本已经支持：

- 通过 GitHub Device Flow 在浏览器中完成多账号登录
- 在多个 GitHub 账号之间切换当前活跃身份
- 拉取组织列表与仓库列表，并按归属方分组展示
- 将 GitHub access token 保留在 Electron 主进程，并使用 `safeStorage` 做本地加密存储（系统不支持时退化为明文加密模式）

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

## License

Apache-2.0
