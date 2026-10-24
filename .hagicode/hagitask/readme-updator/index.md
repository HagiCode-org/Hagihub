---
public: true
multilingual: false
style: product
---

# README requirements

## Product focus

- Present Hagihub as an Electron desktop app that lets people work with several GitHub accounts in one workspace: sign in through GitHub Device Flow, switch the active account, and browse organizations and repositories grouped by owner.
- Address people who use Hagihub. The README is written in Chinese; keep it in Chinese.
- Open with the positioning statement and the list of what the current version supports, then explain how to sign in and use it.

## Required content

- Keep the positioning statement, the supported-feature list, the usage and authorization flow, the requested scopes, the security model and the Apache-2.0 license section.
- State only login and repository features that `src/` shows; keep the statement that the access token stays in the Electron main process.
- Keep the Apache-2.0 license badge consistent with `LICENSE`.

## Exclusions

- Exclude OAuth client secrets, access tokens, signing credentials, internal hosts, machine-specific paths and private links.
- Keep repository maintenance instructions out of the README: tech stack inventory, project structure, development and build steps, CI/CD and signing pipelines.
- Do not list features the repository does not show.
