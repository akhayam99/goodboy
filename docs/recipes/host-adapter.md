# Recipe: a host adapter (GitHub, GitLab, Bitbucket)

> **Read this when** a pull request or merge request fact comes from a host.
> **Not for** the row table ([hosts.md](../hosts.md) owns it).

## Steps

1. Follow [hosts.md](../hosts.md) → Adding a host for a new host: the type, the row, the adapters, the fake, the bridge verbs.
2. For a new fact on an existing host, add the field to the row first, then read it in all three adapters. GitLab and Bitbucket are Rust (`gitlab.rs`, `bitbucket.rs` under `apps/desktop/src-tauri/src/`). GitHub has no Rust adapter for request data: its facts come from `gh` commands built in `packages/core/src/github/`, and `github.rs` only runs `gh` under the bounded runner. The agent bridge repeats some `gh pr` commands in `query_bridge/github.rs`; change both when a field or a limit changes ([hosts.md](../hosts.md) → Where each adapter lives).
3. Fill the vendor page the fact comes from in the table of [hosts.md](../hosts.md).
4. Show the fact through `apps/desktop/src/shared/utils/pullRequestPresentation.ts` so one function owns what the screen says.
5. A host that cannot answer shows the gap in the UI; it never guesses.

## Network rules every adapter shares

- One client: `integrations::http::client()`. It follows a redirect only inside the same origin (scheme, host and port), at most five, so a token header never reaches another host. A cross-origin 3xx comes back as the answer and the adapter reports it as an http error.
- A host address is checked with `integrations::http::require_secure_scheme`: `https`, or `http` for localhost only. A bad address is `InvalidInput`.
- A read goes through `send_retrying`: it retries a 429, 502, 503 or 504 (waiting for `Retry-After` when the host sent it, capped at five seconds) and a failed connect, up to three attempts. It never retries a read that timed out, so a hanging host costs one wait. A write (POST, PUT, DELETE) goes through the plain client and is never retried, because a second attempt could do the thing twice.
- The error kind and the retry hint come from `integrations/failure.rs` (see [hosts.md](../hosts.md) → What a host failure looks like).
- A path segment in a url goes through `percent_encode`. A value inside a query language (JQL, Bitbucket's `q`) goes through `integrations::quote::quoted_literal`, so a quote or a backslash cannot close the literal.
- A command that runs `gh` or `git` goes through the bounded runner (`proc::git::run_with_timeout`): it puts the child in its own process group and kills the whole group at the timeout, so a grandchild that holds the pipe open cannot keep the call alive.
- Find-the-request-by-branch follows one contract on every host ([hosts.md](../hosts.md) → Find the request for a branch).
- A paged read stops at `util::limits::MAX_PAGES`. The helper behind it returns `Paged { items, is_truncated }` and logs a warning when the list was cut, so a long list is not mistaken for a full one. Every other size limit is a named constant in `util/limits.rs`, and a message that names a limit prints it with `format_limit`.

## Test

The review source contract with the host's fake, plus a Rust test per adapter. A network rule gets a test against a local listener (`integrations::http::test_support`): the redirect, the retry count and the page cap are all checked that way.

## Docs that move

[hosts.md](../hosts.md), and the review feature doc ([review.md](../features/review.md)).

## Failure-mode rows that apply

Hosts touched, failure shown, late response, number owner.

## Guards

The review source contract, the bridge verbs parity test, `check:doc-refs`.
