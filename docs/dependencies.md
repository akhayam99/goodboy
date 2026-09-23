# Dependency policy

> **Read this when** adding a new package or checking whether one is
> justified. **Not for** which workspace may import which (see that
> workspace's `CONVENTIONS.md`).

This is the single source of truth for adding and checking dependencies. Every dependency is a liability. Add the fewest you can, check each one, and audit them regularly.

## Before adding any dependency, verify

1. **Necessary?** Could we use the standard library, a Web API, Tauri APIs, or 20 lines of our own code instead?
2. **Maintenance**: last release within 6 months, active issues and PRs, more than one maintainer if possible.
3. **Adoption**: at least 100k weekly downloads on npm, OR a strong reputation (a known org or person).
4. **Size**: you know how much it adds to the bundle. No hidden 5MB trees of sub-dependencies.
5. **License**: MIT, Apache 2.0, BSD, or ISC only. No copyleft, no custom licenses.
6. **Security**: `pnpm audit` is clean. No known unpatched CVEs.
7. **Transitive deps**: run `pnpm why <pkg>` after install. If it pulls in 50 packages, think again.

## Rules of thumb

- Prefer Web APIs, Node built-ins, and Tauri APIs over npm packages.
- Prefer one well-maintained package over several small ones that do similar things.
- No utility libraries (lodash, ramda, etc.). Write the function or use native methods.
- No CSS-in-JS runtimes. Tailwind only.
- No date libraries unless truly needed. Use `Intl` and native `Date`.
- No HTTP clients. Use `fetch`.
- Approved core deps: `react`, `react-dom`, `typescript`, `vite`, `tailwindcss`, `@tauri-apps/*`, `zustand`.
- Anything else needs a justification in the PR description.

The rules for internal workspace deps (the `workspace:*` protocol, no phantom deps) live in [CONVENTIONS.md](../CONVENTIONS.md) → pnpm.

## Upgrades: stable over newest

A brand-new version is one that nobody has used in real work yet.
Follow the stable release most people use, not the latest tag.

- **Runtimes and their types move together, on LTS.** We ship on Node 24, so
  `@types/node` is pinned to `^24`. If the types are ahead of the runtime, the
  typechecker accepts APIs that do not exist at run time.
- **Majors are never automatic.** A major bump is a migration. It gets its own
  branch, a clean install, typecheck, the full suite, and a real build. Majors
  that share a toolchain (Vite, its plugins, vitest) land together, not as
  separate PRs.
- **A `0.x` minor is a major.** Cargo and npm both treat it as breaking.
- **Minor and patch bumps are the normal path.** They still need install +
  typecheck + suite before merging, plus `cargo test --locked` when
  `Cargo.lock` changed.
- **Close the upgrades we are not ready to migrate**, and write the reason in the PR.

## Enforcement

`pnpm audit` runs on CI. Someone reviews the `pnpm-lock.yaml` diff by hand on every PR.
