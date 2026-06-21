# Dependency policy

The single source of truth for adding and vetting dependencies. AGENTS.md carries
a one-line bar and CONVENTIONS.md points here; do not restate the policy
elsewhere.

Every dependency is a liability. Add the minimum, vet each one, audit regularly.

## Before adding any dependency, verify

1. **Necessary?** Can we use the standard library, a Web API, Tauri APIs, or 20 lines of code instead?
2. **Maintenance**: last release within 6 months, active issues/PRs, multiple maintainers if possible.
3. **Adoption**: at least 100k weekly downloads on npm, OR strong reputation (known org/individual).
4. **Size**: bundle impact known. No hidden 5MB transitive trees.
5. **License**: MIT, Apache 2.0, BSD, or ISC only. No copyleft, no custom licenses.
6. **Security**: `pnpm audit` clean. No known unpatched CVEs.
7. **Transitive deps**: `pnpm why <pkg>` after install. If it pulls in 50 packages, reconsider.

## Rules of thumb

- Prefer Web APIs, Node built-ins, and Tauri APIs over npm packages.
- Prefer one well-maintained package over multiple small ones doing similar things.
- No utility libraries (lodash, ramda, etc.): write the function or use native methods.
- No CSS-in-JS runtimes: Tailwind only.
- No date libraries unless absolutely needed: use `Intl` and native `Date`.
- No HTTP clients: use `fetch`.
- Approved core deps: `react`, `react-dom`, `typescript`, `vite`, `tailwindcss`, `@tauri-apps/*`, `zustand`.
- Anything else requires justification in the PR description.

Internal workspace deps (the `workspace:*` protocol, no phantom deps) are governed by [CONVENTIONS.md](../CONVENTIONS.md) → pnpm.

## Enforcement

`pnpm audit` runs on CI. Manual review of `pnpm-lock.yaml` diff on every PR.
