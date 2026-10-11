# Recipe: a host adapter (GitHub, GitLab, Bitbucket)

> **Read this when** a pull request or merge request fact comes from a host.
> **Not for** the row table ([hosts.md](../hosts.md) owns it).

## Steps

1. Follow [hosts.md](../hosts.md) → Adding a host for a new host: the type, the row, the adapters, the fake, the bridge verbs.
2. For a new fact on an existing host, add the field to the row first, then read it in all three adapters under `apps/desktop/src-tauri/src/` (`github.rs`, `gitlab.rs`, `bitbucket.rs`).
3. Fill the vendor page the fact comes from in the table of [hosts.md](../hosts.md).
4. Show the fact through `apps/desktop/src/shared/pullRequestPresentation.ts` so one function owns what the screen says.
5. A host that cannot answer shows the gap in the UI; it never guesses.

## Test

The review source contract with the host's fake, plus a Rust test per adapter.

## Docs that move

[hosts.md](../hosts.md), and the review feature doc ([review.md](../features/review.md)).

## Failure-mode rows that apply

Hosts touched, failure shown, late response, number owner.

## Guards

The review source contract, the bridge verbs parity test, `check:doc-refs`.
