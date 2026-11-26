# Traps in the toolchain

> **Read this when** a hook, a test run, CI, the build or a worktree install
> behaves oddly. **Not for** SQLite and migration traps
> ([database.md](database.md)) or the branch and commit rules
> ([../../CONVENTIONS.md](../../CONVENTIONS.md)).

## Worktrees and hooks

### A new worktree's `pnpm install` exits 1

Its `prepare` step runs `lefthook install`, which refuses while `core.hooksPath` points at the shared `.git/hooks`. Dependencies and native bindings install first, so check that `node_modules` and `better_sqlite3.node` exist and carry on. Do not repoint `core.hooksPath`: the hooks find their tools through the common git directory.

### The pre-commit hook borrows the main checkout's tools

`lefthook.yml` finds `prettier` and `commitlint` in the main checkout's `node_modules` (through the common git directory), since a worktree may have no install. It runs them from the current directory, so prettier still sees files that exist only in the worktree.

### commitlint wants a lower-case subject

A camelCase identifier in the subject fails `commit-msg`; name it in the body. The header is capped at 72 characters.

## Test runs

### A worktree installed without scripts fails two suites quietly

Installed with `--ignore-scripts`, it has no `better-sqlite3` binding, which `@goodboy/db` and `@goodboy/core` need. `turbo run test --continue` runs every other package, so the output's end can look healthy. Read the summary.

### A `FULL TURBO` green can be a replay

Turbo replays cached results. When the green must mean something, run `pnpm exec turbo run test --force` and look for `0 cached`.

### Arguments after pnpm test never reach turbo

`pnpm test -- <arg>` never reaches turbo. pnpm passes the `--` through, and turbo hands everything after it to every package's vitest: `--force` dies with `CACError: Unknown option`, and a file name still runs every package. Force with `pnpm exec turbo run test --force`; run one file with `pnpm --filter @goodboy/<pkg> exec vitest run <path>`.

### A Rust test that runs a script it wrote can hit `Text file busy`

On Linux another test forks while the script is open for writing, and the child holds the handle until it execs, so the probe reads "did not start". Wait until the script runs before asserting, as `runnable` in `providers/cli_probe.rs` does.

### `lsof` exits 1 when it finds nothing

No listener, or a pid that died between reads. The monitor reads 0 and 1 as success, anything else or a timeout as a failed snapshot, so a quiet machine never shows a broken monitor.

## Rust and CI

### `cargo fmt` formats the whole crate

Whatever file you name. `main` is fmt-clean and `rust.yml` blocks on it, so a run should touch only files the change edited; if it rewrites others, your toolchain is not the one in `rust-toolchain.toml`.

### CI has no "run workflow" button

`ci.yml` and `rust.yml` have no `workflow_dispatch`. Push another commit, or re-run a finished run from the Actions UI; closing and reopening the PR is the last resort.

## The build and the webview

### The webview CSP admits no remote image

The policy lives in `apps/desktop/src-tauri/tauri.conf.json`, and the dev server has none, so a scene never shows what it blocks. `img-src` admits `'self'`, `data:` and `blob:`, nothing remote: without `blob:` a `URL.createObjectURL` preview (the composer chip, the workspace chat bubble) is a broken box with only a console error. `csp-img-src.test.ts` pins it; widen no other directive for an image.

### A bundled dependency must not assign to an Object.prototype name

`public/freeze-prototype.js`, the first script of `apps/desktop/index.html`, freezes `Object.prototype` before any app script ([browser.md](browser.md#every-tab-gets-the-apps-initialization-scripts) says why `freezePrototype` in `tauri.conf.json` stays off). Then `namespace.toString = fn` on a plain object throws "Attempted to assign to readonly property" in strict mode. `@xterm/xterm` and `@xterm/addon-webgl` do that for their key code namespace, so the terminal chunk threw and the panel never rendered, in the installed app only.

`vite/xtermFrozenPrototype.ts` rewrites the assignment to `Object.defineProperty` for those two packages, and `vite/xtermFrozenPrototype.test.ts` runs the shipped namespace under a frozen prototype. The plugin also keeps every `@xterm/*` package out of `optimizeDeps`, because the dev server's pre-bundle in `node_modules/.vite/deps` skips the rewrite; each ships one ES module, so this costs no start time. A new `@xterm/*` dependency is listed there, or the test fails.

After an xterm upgrade, build and grep the `GenericTerminalPanel` chunk for `.toString=`. The test fails when a shipped file loses the pattern; remove the plugin then.
