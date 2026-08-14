# Dependency policy

> **Read this when** adding a new package or reviewing whether one is
> justified. **Not for** workspace import boundaries (see that workspace's
> `CONVENTIONS.md`).

The single source of truth for adding and vetting dependencies. Every dependency is a liability. Add the minimum, vet each one, audit regularly.

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

## Upgrades: stable over newest

A version that just shipped is a version nobody has run in anger yet. Track the
stable, widely adopted release, not the latest tag.

- **Runtimes and their types move together, on LTS.** We ship on Node 24, so
  `@types/node` is pinned to `^24`: types ahead of the runtime make the
  typechecker accept APIs that do not exist at run time.
- **Majors are never automatic.** A major bump is a migration: its own branch,
  clean install, typecheck, full suite, real build. Majors that share a
  toolchain (Vite, its plugins, vitest) land together, not as separate PRs.
- **A `0.x` minor is a major.** Cargo and npm both treat it as breaking.
- **Minor and patch bumps are the routine path**, and still need install +
  typecheck + suite before merging, plus `cargo test --locked` when
  `Cargo.lock` moved.
- **Close what we are not ready to migrate**, with the reason written in the PR.

## Enforcement

`pnpm audit` runs on CI. Manual review of `pnpm-lock.yaml` diff on every PR.
