# Recipe: a Tauri command

> **Read this when** the frontend needs something only Rust can do. **Not for**
> a table write that `packages/db` can do ([architecture.md](../architecture.md) → Who writes each table).

## Steps

1. Write the command in the Rust module that owns the area under `apps/desktop/src-tauri/src/`, as `#[tauri::command]`. A blocking body is `async` or runs off the main thread ([architecture.md](../architecture.md)).
2. Register it in the `generate_handler!` list in `apps/desktop/src-tauri/src/lib.rs`.
3. Call it from one typed wrapper in the feature folder. A component or hook never calls `invoke` directly.
4. Add the argument and result types to `packages/types` when both sides share them.
5. Take a target (workspace, project, mount, session) as an argument; never read the current one.

## Test

A `cargo test` for the command with a temp repo or database (`git init --bare -b main`), and a frontend test that stubs the Tauri boundary only.

## Docs that move

The doc that owns the concept ([README.md](../README.md) ownership table), and [hosts.md](../hosts.md) when a host is touched.

## Failure-mode rows that apply

Target, failure shown, retry, late response, hosts touched.

## Guards

`pnpm run check:tauri-commands`, `cargo clippy -D warnings`, `invoke-in-component` in the forbidden patterns.
