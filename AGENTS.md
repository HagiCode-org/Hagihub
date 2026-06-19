# Hagihub - Agent Configuration

## Root Configuration

Inherits all behavior from `/AGENTS.md` at the monorepo root. Local rules extend or override the root file for this repository.

## Project Context

Hagihub is an Electron-based multi-account GitHub management desktop application for switching between multiple GitHub identities, browsing personal and organization repos, and providing a unified entry point for repo collaboration and AI workflows.

## Working Directory

Run commands from `repos/Hagihub/`.

## Key Commands

```bash
npm install
npm run dev
npm run build:prod
npm run build:win
npm run build:mac
npm run build:linux
npm run typecheck:main
npm run typecheck:preload
npm run typecheck:renderer
npm test
npm run lint
```

## Key Paths

- `src/main/`: Electron main process
- `src/preload/`: context bridge
- `src/renderer/`: React UI (Redux Toolkit, react-i18next, shadcn/ui, Tailwind CSS 4)
- `src/renderer/locales/`: i18n translation files (zh-CN, en-US)

## Agent Guidelines

- Respect the Electron boundary between main, preload, and renderer code.
- Keep renderer changes aligned with existing React, Redux Toolkit, shadcn/ui, and Tailwind CSS patterns.
- Route all user-facing strings through i18next/react-i18next with `hagi18n` YAML management.
- GitHub access tokens must stay in Electron main process with `safeStorage` encryption.
- Use Vite 8 for renderer and preload builds.

## References

- `README.md`
