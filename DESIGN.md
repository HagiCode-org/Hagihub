# DESIGN

## Product Overview

- Product name: Hagihub
- Register: product
- Surface: Electron desktop workspace for GitHub repository and automation management
- Primary mood: focused, operational, editor-like

## Design Direction

- Scene: a maintainer reviewing repository activity on a large monitor in a dim workspace, where clarity and density matter more than visual spectacle.
- Color strategy: restrained, with graphite neutrals and a single warm amber accent for selection, action, and live status.
- Shape language: squared-off panels with soft 10px to 18px radii, thin borders, and pane separation inspired by code editors rather than marketing dashboards.
- Motion: minimal, quick, state-only. No choreographed entry animation.

## Color System

- Background: deep graphite with blue-green tint, layered into canvas, sidebar, and panel surfaces.
- Foreground: warm neutral text with high contrast against dark surfaces.
- Accent: amber-gold for primary actions, active navigation, and positive live indicators.
- Support hues:
  - Slate-blue for secondary surfaces and hover states.
  - Muted green for healthy automation states.
  - Soft red for failures and destructive feedback.
  - Muted yellow for caution and plaintext token storage warnings.

## Typography

- UI sans: IBM Plex Sans / Segoe UI Variable / PingFang SC / system sans.
- Data mono: JetBrains Mono / SFMono-Regular / ui-monospace.
- Use mono selectively for repository metadata, counts, runtime values, and status bar data.
- Keep hierarchy tight. Large display text is not part of the normal product vocabulary.

## Layout

- Three-part shell by default:
  - Left activity rail and section navigation.
  - Central work area for repository and account operations.
  - Persistent bottom status bar for runtime, account, and repository counts.
- Treat groups as panes, not marketing cards.
- Prefer row-based repository presentation over large repeating card grids.

## Components

- Navigation items should feel like editor tabs or activity entries, with active state indicated by full-row tint and subtle inset highlight.
- Repository rows should include owner avatar, repo name, semantic badges, short description, update time, and a direct open action.
- Status badges must use text plus icon, never color alone.
- Empty states should teach the next operational step in plain language.
- Surface system/runtime information as read-only panels with mono values and concise labels.

## Content Style

- Labels should be short, technical, and direct.
- Prefer verbs tied to real actions: refresh, open, authorize, inspect, switch.
- Avoid promotional copy, abstract slogans, and repeated explanatory text.

## Responsive Behavior

- Desktop-first, but still usable on narrower widths by stacking panes and collapsing dense secondary detail.
- Preserve readable line lengths and avoid horizontal overflow in common laptop widths.
