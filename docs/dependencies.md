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

## Hard rules

- **Write it in-house first.** If our own version fits in a few hundred lines,
  write it. A dependency has to earn its place against that.
- **Too young or too quiet is a no.** A library younger than one year, or one
  without a release in the last 6 months, is refused. There are no exceptions.
- **Every new dependency gets a `Dependency` section in the PR body.** Name the
  package, why the in-house version does not fit, and how it scores on the
  checklist above.

## Rules of thumb

- Prefer Web APIs, Node built-ins, and Tauri APIs over npm packages.
- Prefer one well-maintained package over several small ones that do similar things.
- No utility libraries (lodash, ramda, etc.). Write the function or use native methods.
- No CSS-in-JS runtimes. Tailwind only.
- No date libraries unless truly needed. Use `Intl` and native `Date`.
- No HTTP clients. Use `fetch`.
- Approved core deps: `react`, `react-dom`, `typescript`, `vite`, `tailwindcss`, `@tauri-apps/*`, `zustand`.
- Approved for code highlighting: `shiki`, with its JavaScript regex engine.
  That engine works under our content security policy with no WebAssembly.
  It lives in `apps/desktop/src/features/diff/lib/highlight`, runs in a web
  worker, and loads each grammar as its own chunk. Its theme paints sentinel
  colours that map back to the `text-syntax-*` classes, so the app theme sets
  the colours and no inline style is rendered.
- Anything else needs a justification in the PR description.

## Rust crates audit

Checked against the rules above on 25 September 2026, with crates.io numbers.
Versions are the ones in `apps/desktop/src-tauri/Cargo.lock`. All three are
past the 6 month release gap. That rule blocks new dependencies. For crates we
already ship, a gap on a mature crate with wide use is a watch, not a removal.

- **`snow` 0.9.6** (Noise protocol for the companion bridge handshake): keep,
  watch. Latest 0.10.0 (July 2025), 27M downloads. It is cryptography, which we
  never write in-house, and it is the reference Rust implementation of Noise.
  Move to 0.10 in a separate PR. Replace it if a security issue goes unanswered.
- **`portable-pty` 0.9.0** (the terminal, project scripts and provider login
  shells): keep, watch. Latest 0.9.0 (February 2025), 17M downloads. It comes
  from the WezTerm project and covers macOS, Linux and Windows behind one API.
  An in-house version would be thousands of lines of platform code. The only
  smaller option, `pty-process`, is Unix only.
- **`qrcode` 0.14.1** (the QR code that pairs the companion): keep, watch.
  Latest 0.14.1 (July 2024), 21M downloads. The encoder is a finished spec with
  no network or file access. The usual alternative, `qrcodegen`, has an older
  last release (April 2022), so switching gains nothing.

The rules for internal workspace deps (the `workspace:*` protocol, no phantom deps) live in [CONVENTIONS.md](../CONVENTIONS.md) → pnpm.

## Upgrades: stable over newest

A brand-new version is one that nobody has used in real work yet.
Follow the stable release most people use, not the latest tag.

- **Runtimes and their types move together, on LTS.** `@types/node` stays on
  the Node major that CI runs. If the types are ahead of the runtime, the
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
