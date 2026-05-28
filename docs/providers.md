# Provider Integration Guide

Goodboy orchestrates AI sessions through your locally installed CLI tools. This guide covers how to install, connect, and manage each supported provider.

---

## Anthropic (Claude)

### Install

```bash
npm install -g @anthropic-ai/claude-code
```

Docs: <https://docs.anthropic.com/en/docs/claude-code/getting-started>

Verify: `claude --version`

### Connect

```bash
claude /login
```

Goodboy opens an external terminal for the OAuth flow. A browser window will open to complete login.

### Disconnect

```bash
claude /logout
```

### Subscription tier

Requires **Claude Max** (or Claude Pro). Goodboy uses your subscription cap — not an API token. API-key-only accounts are not supported for orchestration turns.

### Summarizer model

`claude-haiku-4-5` — the cheapest available Claude tier. Used for automatic context summarization between turns to keep context windows lean.

---

## Cursor

### Install

```bash
curl https://cursor.com/install -fsS | bash
```

Installs `cursor-agent` to `~/.local/bin/`. Goodboy invokes the CLI as `cursor-agent` (not `cursor`, which is the IDE binary).

Docs: <https://docs.cursor.com/en/cli/installation>

Verify: `cursor-agent --version`

### Connect

```bash
cursor-agent login
```

Goodboy opens an external terminal for the OAuth flow.

### Disconnect

```bash
cursor-agent logout
```

### Subscription tier

Requires **Cursor Pro**. Goodboy routes turns through Cursor's subscription-based model cap.

### Default models

Cursor surfaces 50+ aliases via `cursor-agent models`. Goodboy exposes a curated subset:

- **Turn**: `composer-2`, `gpt-5.5-high`, `gpt-5.5-medium`, `claude-opus-4-7-thinking-high`, `claude-4.6-sonnet-medium`, `gpt-5.3-codex`.
- **Cheap**: `composer-2-fast` (default), `auto`.

---

## OpenAI (Codex)

### Install

```bash
npm install -g @openai/codex
```

Docs: <https://developers.openai.com/codex/cli>

Verify: `codex --version`

### Connect

```bash
codex login
```

Goodboy opens an external terminal for the OAuth flow.

### Disconnect

```bash
codex logout
```

### Subscription tier

Requires **ChatGPT Plus/Pro/Business/Edu/Enterprise** (preferred) or an `OPENAI_API_KEY` env var. Goodboy uses whichever auth the local `codex` CLI is configured with.

### Default models

Per <https://developers.openai.com/codex/models> (May 2026):

- **Turn**: `gpt-5.5` (default), `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.3-codex-spark`, `gpt-5.2`.
- **Cheap**: `gpt-5.4-mini`.

### Turn spawn args

Goodboy spawns codex non-interactively:

```
codex exec --json --skip-git-repo-check --model <ID> --cd <DIR> -s workspace-write -- <PROMPT>
```

In `bypassPermissions` mode `-s workspace-write` is replaced with `--dangerously-bypass-approvals-and-sandbox`. The TUI you see when running `codex "..."` from a shell is a different mode — Goodboy uses `exec` for headless JSONL streaming.

### Non-TTY auth quirk

codex CLI v0.130 writes `codex login status` output to **stderr** when no TTY is attached. Tauri-spawned children never have a TTY, so Goodboy explicitly reads both streams in the auth check (`AuthCommandOutput::primary_text()` in `apps/desktop/src-tauri/src/providers.rs`). If you see "installed, not logged in" in the providers panel even though terminal `codex login status` returns `Logged in using ChatGPT`, your build predates this fix — rebuild from `feat/providers-overhaul`.

### Debugging

```bash
GOODBOY_DEBUG_CODEX=1 pnpm tauri dev
```

The terminal prints `[codex-debug] auth cmd: …`, the raw stdout/stderr from the auth subprocess, and for every codex turn it prints the full spawn args + exit code + stderr tail. Use this when the providers panel says one thing and the terminal says another.

### Smoke test

Confirm end-to-end auth + spawn work against the real binary:

```bash
GOODBOY_TEST_REAL_CODEX=1 cargo test --lib -- --ignored codex_real
```

Skipped by default; opt in when you want to verify a fresh install.

---

## Google (Gemini)

### Install

```bash
npm install -g @google/gemini-cli
```

Docs: <https://github.com/google-gemini/gemini-cli>

Verify: `gemini --version`

### Connect

```bash
gemini
```

Launching the bare binary triggers the OAuth flow on first run — Goodboy spawns it in an external terminal. Complete the Google sign-in in the browser that opens; credentials land in `~/.gemini/oauth_creds.json`.

### Disconnect

```bash
rm -f ~/.gemini/oauth_creds.json
```

gemini-cli v0.x has no `logout` subcommand. Goodboy wires the disconnect button to remove the credentials file directly.

### Subscription tier

Requires **Google AI Pro** (or the free tier with rate caps). Goodboy uses the local CLI's authenticated Google account; no API key is needed when signed in via OAuth.

### Default models

Per Google's Gemini 2.5 lineup:

- **Turn**: `gemini-2.5-pro` (default).
- **Cheap**: `gemini-2.5-flash` (default), `gemini-2.5-flash-lite`.

All three support a 1M-token context window.

### Turn spawn args

Goodboy spawns gemini non-interactively:

```
gemini -m <MODEL> -p <PROMPT>
```

The working directory is set on the spawned process; gemini-cli has no `--cwd` flag yet. There is no stable structured JSON output today, so the parser treats each stdout line as an `assistant_text` delta and is forward-compatible with a future `--output-format json` mode.

### Auth detection

gemini-cli does not ship a stable `auth status` subcommand. Goodboy probes a few candidates (`gemini auth status`, `gemini whoami`) and falls back to reading the email claim from `~/.gemini/oauth_creds.json` as ground truth. If the providers panel shows "not logged in" after a successful browser flow, click **refresh** so the file check runs again.

---

## Multi-account

A common setup: Claude Pro on `personal@example.com` and Claude Team on `work@example.com`. Each session in Goodboy targets one active identity per provider.

The **providers panel** (Settings → Providers) shows the currently authenticated identity (email or username) for each connected CLI. Verify this before starting a session — the displayed identity is the account that will be billed for every turn.

### How to switch accounts

1. Open **Settings → Providers**.
2. Click **disconnect** next to the provider you want to switch.
3. Complete the logout in the terminal that opens.
4. Click **connect** for the same provider.
5. Log in with the desired account in the terminal / browser.
6. Click **refresh** in the providers panel — the identity display updates to the new account.

---

## Troubleshooting

### CLI not detected (PATH issue)

Goodboy detects provider binaries via `$PATH`. If a CLI is installed but the providers panel shows it as missing:

1. Find the install path — e.g. `which claude` or `npm root -g`.
2. Add the directory to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):
   ```bash
   export PATH="/path/to/bin:$PATH"
   ```
3. Restart your shell, then relaunch Goodboy.

### OAuth callback failure

The login flow opens a system terminal and a browser. If the browser does not open or the callback hangs:

1. Run the login command manually in a terminal (e.g. `claude /login`).
2. Complete the flow there.
3. Return to Goodboy and click **refresh** — the identity should populate.

### Subscription rate-limit errors

Goodboy uses the subscription cap of your CLI. When the cap is hit, the CLI returns an error and the session stalls. Wait for the cap to reset — typically 5 hours for Claude Max. Note: the summarizer runs once per session compaction, so each compaction counts against your cap alongside the primary turn.

### Wrong account connected

If the identity shown in the providers panel is not the account you want:

1. Follow the **switch accounts** steps above.
2. Confirm the updated identity in the providers panel before starting or resuming a session.
