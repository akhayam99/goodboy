# Provider table, Connect and sign-in checks

> **Read this when** you change the provider tables, **Connect**, the commands
> per provider, how a check is read, or the standing and the breaker.
> **Not for** the steps a user follows ([connect.md](connect.md)) or the flags a
> turn passes ([cli-flags.md](cli-flags.md)).

## The provider table

One row per provider, in two tables that `provider-spec-parity.test.ts` keeps
equal (ids, order, binaries).

- Rust: `PROVIDER_SPECS` in `apps/desktop/src-tauri/src/providers/spec.rs`: the
  id, the CLI family (`Cli`), the binary, the read-only chat shape (only Claude
  and Codex) and the sign-in check. `detect_provider`,
  `check_provider_auth_blocking`, the lifecycle exit status and
  `Cli::of_provider` read it. `Cli::of_binary` answers `None` for an unknown
  binary, so a typo gets no arguments instead of Claude's
- TypeScript: `PROVIDER_FLAGS` in `packages/core/src/providers/providerFlags.ts`:
  the binary, `statusSlot`, `shouldReplayHistoryAsText`, `hasAccountTest` and
  `canFollowRules`. A flag exists only when code branches on it, and a test per
  flag pins its value

Never compare with a provider id (`=== 'cursor'`): add a flag and read it.
`provider-id-comparisons.test.ts` counts the comparisons left, and the count only
falls. A new provider follows [add-a-provider](../recipes/add-a-provider.md).

- Full provider lists read `PROVIDER_IDS` (`packages/types/src/provider-registry.ts`),
  checked by `full-provider-lists.test.ts`. Routing persistence reads its
  `EFFORT_LEVELS` (`agent-write.test.ts`). Stored names add the legacy `openai`
  billing name (`packages/types/src/provider.ts`)
- `codex_home()` in `codex_rollout.rs` is the only place that resolves
  `CODEX_HOME`. `exit_code_of` in `proc/pty.rs` turns a finished PTY child into
  the exit code the lifecycle and terminal events carry

## How Connect works

**Connect** installs the CLI if it is missing, then runs its login, both in a
hidden terminal (a PTY). The store keeps one attempt per provider, and closing the
card does not stop it.

- `browserOwner` in the capability table owns the sign-in tab. Claude, Codex and
  Copilot (`cli`) open the browser themselves. Cursor and the opencode family
  (`goodboy`) get one tab from Goodboy, on the first sign-in URL in the output
- Cursor starts with `NO_OPEN_BROWSER=1` (from `loginEnv`), so it opens no second
  tab
- The best sign-in URL stays on the card. **Open the sign-in page again** waits
  4 seconds, so it never invites a second tab
- `reauthSignsOut` marks a CLI whose login signs you out first (Codex), so **Sign
  in again** goes through an inline confirm
- The sign-in is checked by asking the CLI, never by the exit code, because some
  CLIs keep running while they wait for the browser

Timers in `apps/desktop/src/store/slices/providers/connectProvider.ts`:

- `STALL_MS` (15s): the login went quiet, so the hidden terminal appears
- `HANDOFF_LONG_MS` (30s): the card says it is still waiting for the browser
- `HANDOFF_FALLBACK_MS` (120s): the card offers **Open in Terminal.app**
- `POST_EXIT_PROBE_MS` (60s): after the CLI exits, Goodboy keeps checking

## Connect tiers

`PROVIDER_CONNECT_CAPABILITIES` in `packages/core/src/providers/provider-connect.ts`
holds each provider's connect options, not UI code.

| Provider                       | Tier        | Why                                  |
| ------------------------------ | ----------- | ------------------------------------ |
| anthropic, codex, cursor       | `one-click` | No prompts, sign-in gets checked     |
| copilot                        | `one-click` | No prompts, sign-in can't be checked |
| opencode, openrouter, moonshot | `assisted`  | Login is a menu                      |
| gemini                         | `manual`    | `agy` has no sign-in command         |

- `assisted`: when `opencode auth login` goes quiet on its menu, the terminal
  appears. The sign-in is still checked at the end
- `manual`: the card shows `manualReason` and a docs link, with no **Connect** and
  no **Sign in again**
- `isApiProvider` reads `PROVIDER_KIND` (`packages/core/src/providers/provider-catalog.ts`),
  which marks openrouter and moonshot `api`. Their Account group shows the OpenCode
  runtime with **Detect** and the keys instead of the connect card

## Commands per provider

`PROVIDER_LIFECYCLE_COMMANDS` (`packages/core/src/providers/provider-commands.ts`)
holds the exact commands. If this page and that constant disagree, the constant
is right.

| Provider                       | Connect                        | Disconnect                | Sign-in check         |
| ------------------------------ | ------------------------------ | ------------------------- | --------------------- |
| anthropic                      | `claude auth login --claudeai` | `claude auth logout`      | `claude auth status`  |
| cursor                         | `cursor-agent login`           | `cursor-agent logout`     | `cursor-agent status` |
| codex                          | `codex login`                  | `codex logout`            | `codex login status`  |
| gemini                         | none                           | delete the session folder | session folder        |
| copilot                        | `copilot login`                | none                      | none                  |
| opencode, openrouter, moonshot | `opencode auth login`          | `opencode auth logout`    | `opencode auth list`  |

The same constant holds the install and `update` commands: an npm install for
claude, codex, copilot and the opencode family (`@latest` to update, but
`claude update` for claude), and the vendors' `curl` installers for cursor and
gemini. A
provider without an update command runs its install again, which is how the
cursor and gemini installers update. The gemini logout is
`rm -rf ~/.gemini/antigravity-cli`.

An `npm install -g` runs through `shell_command` in `provider_commands.rs`. When
it fails and `npm ping` cannot reach the configured registry, it retries once with
`--registry=https://registry.npmjs.org/` and says so; the npm settings are never
written. A failed Claude install also prints the official installer line.

### Update results

Rust re-detects after the exit and reports the first matching binary on the PATH
in `ProviderStatus.path`. `cliUpdateResultOf` compares the versions before and
after, and `CliUpdateNotice` and the chat `CliTooOldNotice` share the result
through `useCliUpdate`.

- updated: the version changed, so the notice says "updated to X" and the toast
  fires. Exit 0 with no change never toasts
- unchanged: exit 0, same version. A warning names the binary on PATH and the
  update command, keeps the terminal and offers Retry. `claude update` can update
  another install than the one first on PATH
- failed: a non-zero exit, the error notice with the terminal

## How the checks read the answer

Every version and sign-in check runs through `proc/probe.rs`. It starts the CLI
in its own process group, and on the deadline kills the whole group and waits for
the child, so a timed-out check never leaves a `<defunct>` process.

- Budgets: 5 seconds to detect, 10 for a sign-in check, 15 for codex. A timeout is
  retried once after 3 seconds. Each failure logs one `[probe]` line with the
  provider, the kind and the milliseconds
- `ProviderStatus.errorKind` is `notFound`, `timeout` or `exit`. Only `notFound`
  means not installed
- A non-zero exit on `--version` sets `ProviderStatus.error` to the CLI's last
  non-empty line (stderr first, then stdout, trimmed, 160 characters at most) plus
  `(exited with code N)`, or only `exited with code N` (`exit_failure_reason` in `providers.rs`).
  The setup Agents step shows it under Can't start
- Parsers read the exit code and the output together. `claude auth status` and
  `codex login status` exit 1 when signed out, which reads as disconnected.
  Unrecognised output is `unknown`, with a `reason`

### Claude version floor

`claude --version` runs first. `claude auth status` runs only from
`CLAUDE_AUTH_MIN_VERSION` (2.1.41, `providers/claude_version.rs`), because an
older claude reads `auth status` as a prompt.

- Below it, Goodboy reads `oauthAccount.emailAddress` from `.claude.json` (in
  `CLAUDE_CONFIG_DIR`, else the home folder) and answers `connected` with
  `verified: false`, or `unknown`, with the reason `cli_too_old`
- Sign in and sign out are refused before they start (`lifecycle_refusal`), and
  the setup Agents row shows Update needed with an Update button

### Copilot and Cursor

- `check_copilot_auth` never starts the CLI, since it has no status command: it
  answers `connected`, `verified: false`, reason `no_status`. Detection still
  probes `copilot --version`. The keychain sign-in is never read
- Cursor reads `cursor-agent status --format json`, falling back to plain text.
  `isAuthenticated` and `hasAccessToken` prove local tokens; an email in `message`
  or `about` proves the server knows the account. Tokens without an email give
  `connected` with `verified: false`, which is how the CLI looks when it says
  "Logged in (unable to fetch user details)" and still fails every run

### Reasons are typed

`AuthState.reason` is a typed `AuthReason` (`providers/auth_reason.rs`), never a
sentence. The kinds are closed:

- `timed_out` with its `secs` (the budget the check ran under)
- `not_installed`
- `spawn_failed` and `cli_said` with a `detail` (the OS or CLI words)
- `printed_nothing`
- `exited_with_code` with its `code`
- `no_exit_code`, `empty_command`, `no_access_token`, `not_confirmed_by_server`,
  `no_status`, `unknown_provider` and `check_unfinished`
- `cli_too_old` with the `version` found (or null) and the `minimum`

`authReasonSentence` in `features/providers` writes one sentence per kind, and
`probeOutcomeOf` hands it to the connection history. A chat that cannot run
read-only fails with `not_read_only`, which `chatStartError` turns into
`CHAT_PROVIDER_REFUSAL`, the sentence the model picker shows.

## Standing, evidence and the breaker

`providerHealth` (`store/slices/providers/providerHealth.ts`) keeps, per provider
id and never per identity, a `standing` and its `evidence`. The screen reads the
standing, never one probe's answer.

- `standing`: `connected`, `signed_out`, `cannot_check`, `missing` or `unknown`
- `evidence`: local tokens, `serverAccepted` (the server knows the account, or a
  run was accepted), and the last probe, good state and run with their times
- The reducer also keeps the probe failures and refusals of the last 10 minutes,
  the last identity, the last refusal message and the last 50 standing changes

### Rules

Pinned by `providerHealth.test.ts`:

- A probe with no answer never changes the standing. Three in 10 minutes make
  `cannot_check`; one good probe clears it
- Only `errorKind: notFound` means `missing`
- "not logged in" must come twice, 10 seconds apart, before `signed_out`. It
  counts at once after a Goodboy sign-out or lifecycle exit (`isImmediate`), and
  for a provider never confirmed
- A run refused for authentication adds a refusal (`feedAuthRefusal`, from the
  stream and `recoverTurnFailure`, once per run). Three in 10 minutes open the
  breaker. A good run or a new sign-in closes it; a good probe does not, because
  the probe said "connected" for 95 Cursor runs that were all refused

`connectionOfHealth` derives `ProviderConnectionState`, so readers of
`connection === 'connected'` keep working. `cannot_check` reads as `connected`
when a last good state exists.

An open breaker keeps `connected` and sets `isBreakerOpen`. Only automatic
routing reads it: `autoRoutableProviders` leaves the provider out of Auto, the
fallbacks and the policy (`autoLimitContext`, `workflowAvailabilitySnapshot`,
`routeTurn`, helper tasks). An explicit pick, an agent pin or a retry still runs.

### Refresh

`refreshProviders` keeps one run in flight per app, and a second caller joins it.
A request after a change (`isFresh`: connect, sign-out, Check again) queues one
more run. A result older than the last applied sequence number is dropped.

- Triggers: boot, focus after 5 minutes (60 seconds while a provider is
  unhealthy), **Check again**, connect, sign-out, and opening a provider page whose
  last confirmation is older than 60 seconds
- A first "not logged in" asks again 12 seconds later by itself
- `log_provider_standing` logs each change:
  `[providers] standing cursor connected -> cannot_check: <reason>`

### What the screen says

- Rail words (`standingWord.ts`, also used by History): nothing when confirmed,
  `Not confirmed`, `Can't check`, `Signed out`, `Refused your runs`
- `cannot_check` keeps Usage and Models on the page, with a notice and **Check
  again**. An open breaker adds a notice with **Sign in again** and **Details**
  (the raw message)
- The header says whether the account is only signed in on this Mac or confirmed
  by the provider, and when
- The transcript's refused run card shows only for `signed_out` or an open breaker
