# Recipe: add a provider

> **Read this when** a new agent CLI or API provider joins the app next to Claude, Cursor, Codex, Gemini, Copilot and OpenCode.
> **Not for** a new model of an existing provider ([providers.md](../providers.md) → Models and effort owns that), or a new host for pull requests ([host-adapter](host-adapter.md)).

A provider is one row of two tables that a test keeps equal, plus the catalog, the commands and the screens that name it. Do the steps in this order; each one has a guard that fails when it is skipped.

## Steps

1. Read the rule first: every version and sign-in check runs through `proc/probe.rs`, which puts the CLI in its own process group and kills and reaps it on the deadline ([providers.md](../providers.md) → How the checks read the answer). A check that starts a CLI any other way is wrong.
2. Add the id to `ProviderId` and `PROVIDER_IDS` in `packages/types/src/provider-registry.ts`, and its kind to `PROVIDER_KIND` in `packages/core/src/providers/provider-catalog.ts`. The compiler then lists every `Record<ProviderId, ...>` that needs a row.
3. Add the Rust row: `PROVIDER_SPECS` in `apps/desktop/src-tauri/src/providers/spec.rs` (id, CLI family, binary, chat shape, sign-in check). A new CLI family also adds a `Cli` variant in `providers/cli_args.rs` with its argv, its read-only policy and its stdin rule, and a case in `providers/cli_probe.rs` for the flags it must list. A provider that rides an existing binary reuses that binary and CLI.
4. Add the sign-in check in `providers.rs` (`check_<name>_auth`, parsed from the CLI's own words, exit code and output together), and the `refresh_<name>_status` command with its entry in `lib.rs` and `window-commands.json`.
5. Add the TypeScript row: `PROVIDER_FLAGS` in `packages/core/src/providers/providerFlags.ts`. A flag exists only if code branches on it. Never write `=== '<new id>'` in a screen or a slice: add a flag, read it, and let `provider-id-comparisons.test.ts` keep the count falling.
6. Add the models: a folder under `packages/core/src/providers/` with the catalog, then `catalogs.ts`, `capabilities.ts`, `model-price.ts` and `modeSupport.ts` (`packages/core/src/permissions/modeSupport.ts`, what each permission mode does on this CLI).
7. Add the commands and the connect tier: `provider-commands.ts`, `provider-connect.ts`, `provider-api-key-env.ts` for an API provider, and the Rust table in `provider_commands.rs` (a parity test reads it).
8. Add the screens' words: the label in `providerLabel.ts`, the brand mark in `components/provider-brand.ts`, the order in `ProviderStudio/providerOrder.ts`, the picker copy in `shared/components/RoutingPicker/`, and the Connect guide in `ProviderConnect/guides.ts`.
9. Add the fake CLI: a POSIX `sh` script named like the binary in `apps/desktop/src-tauri/tests/fixtures/fake-cli/`, and a recorded `streams/` file ([testing.md](../testing.md) → fake CLI).
10. A new database column needs a migration: [migration](migration.md). A stored provider name does not: `provider_runs.provider` has had no CHECK list since m126, and `check-parity.test.ts` lists the CHECKs that remain.

## Test

- Rust: a fake-CLI test that asserts the argv and the stream lines for a turn, a side job and the sign-in check (`src/turn/fake_cli_tests.rs`, `src/providers/fake_cli_tests.rs`, `src/providers/cli_args/fake_cli_tests.rs`). Prove it can fail: break the code it covers, see it go red, restore it.
- TypeScript: one test per flag you add (`providerFlags.test.ts`), the catalog test (`catalog.test.ts`), and `modeSupport.test.ts` for the permission table.
- The parity tests: `provider-spec-parity.test.ts` (Rust row equals TypeScript row) and `provider-commands-table-parity.test.ts` (commands).

## Docs that move

[providers.md](../providers.md) (the table of providers, Commands per provider, Connect tiers, The provider table), [features/providers.md](../features/providers.md) when a person sees the provider, and the matching line of `FEATURES.md`.

## Failure-mode rows that apply

Which provider a write names, what the screen shows when the CLI is missing, signed out or silent, the retry after a timeout (one retry, never a loop), a late probe answer for an old request, what a second window shows, and who owns the version and limit numbers.

## Guards

`provider-spec-parity.test.ts`, `provider-id-comparisons.test.ts`, the model catalog tests, `check:tauri-commands`, `cargo test --locked`, `check:doc-refs`.
