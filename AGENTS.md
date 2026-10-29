# Hagihub - Agent Configuration

## Root Configuration

Inherits all behavior from `/AGENTS.md` at the monorepo root. Local rules extend or override the root file for this repository.

## Project Context

Hagihub is an Electron-based multi-account GitHub management desktop application for switching between multiple GitHub identities, browsing personal and organization repos, and providing a unified entry point for repo collaboration and AI workflows.

## Working Directory

Run commands from `repos/Hagihub/`.

## Key Commands

```bash
pnpm install
pnpm run dev                  # renderer (Vite, port 36599) + main tsc watch + preload watch + Electron
pnpm run build:prod
pnpm run build:win
pnpm run build:mac
pnpm run build:linux
pnpm run typecheck:main
pnpm run typecheck:preload
pnpm run typecheck:renderer
pnpm run build:tsc:check     # prepare:i18n + all three typechecks (PR gate)
pnpm run build:linux:dir     # Linux package-only self-check used by PR checks
pnpm run i18n:check          # hagi18n audit + doctor + generated-resource check
pnpm run i18n:sync           # also i18n:audit|report|doctor|prune; use `:write` variants of sync/prune to apply (base locale en-US)
pnpm run smoke-test          # packaging smoke test (also the last step of build:prod)
```

CI uses Node.js 24; PR checks run `pnpm install`, `build:tsc:check`, `build:prod`, and `build:linux:dir`. There is no `test` or `lint` script.

## Key Paths

- `src/main/`: Electron main process
- `src/preload/`: context bridge
- `src/renderer/`: React UI (Redux Toolkit, react-i18next, shadcn/ui, Tailwind CSS 4)
- `src/renderer/locales/`: i18n translation files (zh-CN, en-US); YAML sources, with `generated-locales/` produced by `pnpm run prepare:i18n` (`scripts/generate-i18n-resources.mjs`, never hand-edit)
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

## Package management

- The repository uses pnpm, pinned in `package.json` `packageManager`. Run `corepack enable` once, then `pnpm install`. `pnpm-lock.yaml` is the only lockfile; do not commit `package-lock.json`.
- Settings live in `pnpm-workspace.yaml`. `allowBuilds` lists the dependencies whose install scripts may run (reviewed individually, `false` means reviewed and denied); review any new dependency that has an install script and add it there.
- A local registry mirror belongs in `~/.npmrc` only. Never commit a `registry=` line or a mirror URL; `pnpm run check:registry` (also run in CI) fails on any non-`registry.npmjs.org` `tarball` in the lockfile and on mirror hosts in tracked files.
- Undeclared imports fail under pnpm's strict layout: declare the package instead of hoisting it.
