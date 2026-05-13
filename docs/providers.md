# Provider Integration Guide

kAY.am orchestrates AI sessions through your locally installed CLI tools. This guide covers how to install, connect, and manage each supported provider.

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

kAY.am opens an external terminal for the OAuth flow. A browser window will open to complete login.

### Disconnect

```bash
claude /logout
```

### Subscription tier

Requires **Claude Max** (or Claude Pro). kAY.am uses your subscription cap — not an API token. API-key-only accounts are not supported for orchestration turns.

### Summarizer model

`claude-haiku-4-5` — the cheapest available Claude tier. Used for automatic context summarization between turns to keep context windows lean.

---

## Cursor

### Install

```bash
curl https://cursor.com/install -fsS | bash
```

Installs `cursor-agent` to `~/.local/bin/`. kAY.am invokes the CLI as `cursor-agent` (not `cursor`, which is the IDE binary).

Docs: <https://docs.cursor.com/en/cli/installation>

Verify: `cursor-agent --version`

### Connect

```bash
cursor-agent login
```

kAY.am opens an external terminal for the OAuth flow.

### Disconnect

```bash
cursor-agent logout
```

### Subscription tier

Requires **Cursor Pro**. kAY.am routes turns through Cursor's subscription-based model cap.

### Default models

Cursor surfaces 50+ aliases via `cursor-agent models`. kAY.am exposes a curated subset:

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

kAY.am opens an external terminal for the OAuth flow.

### Disconnect

```bash
codex logout
```

### Subscription tier

Requires **ChatGPT Plus/Pro/Business/Edu/Enterprise** (preferred) or an `OPENAI_API_KEY` env var. kAY.am uses whichever auth the local `codex` CLI is configured with.

### Default models

Per <https://developers.openai.com/codex/models> (May 2026):

- **Turn**: `gpt-5.5` (default), `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.3-codex-spark`, `gpt-5.2`.
- **Cheap**: `gpt-5.4-mini`.

---

## OpenCode

### Install

```bash
npm install -g opencode-ai
```

Also installable via `curl -fsSL https://opencode.ai/install | bash` or `brew install anomalyco/tap/opencode`.

Docs: <https://opencode.ai/docs/>

Verify: `opencode --version`

### Connect

OpenCode is provider-agnostic — it routes to any of 75+ upstream providers via env vars or its keyring. The simplest path:

```bash
opencode auth login
```

Or set the upstream provider env var directly (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN` for GitHub Copilot).

### Disconnect

```bash
opencode auth logout
```

### Default models

Models use the `<provider>/<model>` notation. kAY.am exposes a curated GitHub-Copilot-routed subset (works with the `GITHUB_TOKEN` env var most contributors already have):

- **Turn**: `github-copilot/claude-opus-4.7`, `github-copilot/claude-opus-4.6`, `github-copilot/claude-sonnet-4.6` (default), `github-copilot/gpt-5.4`, `github-copilot/gpt-5.3-codex`, `github-copilot/gemini-3.1-pro-preview`.
- **Cheap**: `github-copilot/claude-haiku-4.5`.

To add custom models, override per-agent via the model picker in **New session → model**.

---

## Multi-account

A common setup: Claude Pro on `personal@example.com` and Claude Team on `work@example.com`. Each session in kAY.am targets one active identity per provider.

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

kAY.am detects provider binaries via `$PATH`. If a CLI is installed but the providers panel shows it as missing:

1. Find the install path — e.g. `which claude` or `npm root -g`.
2. Add the directory to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):
   ```bash
   export PATH="/path/to/bin:$PATH"
   ```
3. Restart your shell, then relaunch kAY.am.

### OAuth callback failure

The login flow opens a system terminal and a browser. If the browser does not open or the callback hangs:

1. Run the login command manually in a terminal (e.g. `claude /login`).
2. Complete the flow there.
3. Return to kAY.am and click **refresh** — the identity should populate.

### Subscription rate-limit errors

kAY.am uses the subscription cap of your CLI. When the cap is hit, the CLI returns an error and the session stalls. Wait for the cap to reset — typically 5 hours for Claude Max. Note: the summarizer runs once per session compaction, so each compaction counts against your cap alongside the primary turn.

### Wrong account connected

If the identity shown in the providers panel is not the account you want:

1. Follow the **switch accounts** steps above.
2. Confirm the updated identity in the providers panel before starting or resuming a session.
