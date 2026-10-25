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
npm run dev                  # renderer (Vite, port 36599) + main tsc watch + preload watch + Electron
npm run build:prod
npm run build:win
npm run build:mac
npm run build:linux
npm run typecheck:main
npm run typecheck:preload
npm run typecheck:renderer
npm run build:tsc:check     # prepare:i18n + all three typechecks (PR gate)
npm run build:linux:dir     # Linux package-only self-check used by PR checks
npm run i18n:check          # hagi18n audit + doctor + generated-resource check
npm run i18n:sync           # also i18n:audit|report|doctor|prune; use `:write` variants of sync/prune to apply (base locale en-US)
npm run smoke-test          # packaging smoke test (also the last step of build:prod)
```

CI uses Node.js 24; PR checks run `npm ci`, `build:tsc:check`, `build:prod`, and `build:linux:dir`. There is no `test` or `lint` script.

## Key Paths

- `src/main/`: Electron main process
- `src/preload/`: context bridge
- `src/renderer/`: React UI (Redux Toolkit, react-i18next, shadcn/ui, Tailwind CSS 4)
- `src/renderer/locales/`: i18n translation files (zh-CN, en-US); YAML sources, with `generated-locales/` produced by `npm run prepare:i18n` (`scripts/generate-i18n-resources.mjs`, never hand-edit)
- `src/main/storage/`, `src/main/github-*.ts`: local account storage, GitHub auth (Device Flow), and API access; `src/main/__tests__/` holds main-process tests
- `src/shared/`: types shared across main, preload, and renderer
- `scripts/`: Electron Forge packaging (`run-electron-forge.js`), MSIX, smoke tests, signing verification
- `.github/workflows/`: `pr-checks.yml`, `build.yml` (+ reusable Windows/Unix builds), `release-draft-action.yml` (drafts via `HagiCode-org/hagi-release-drafter`)
- `PRODUCT.md`, `DESIGN.md`: product and design context for UI work

## Agent Guidelines

- Respect the Electron boundary between main, preload, and renderer code.
- Keep renderer changes aligned with existing React, Redux Toolkit, shadcn/ui, and Tailwind CSS patterns.
- Route all user-facing strings through i18next/react-i18next with `hagi18n` YAML management.
- GitHub access tokens must stay in Electron main process with `safeStorage` encryption.
- Use Vite 8 for renderer and preload builds.

## References

- `README.md`
