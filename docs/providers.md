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

Install the Cursor editor from <https://www.cursor.com>, then enable the `cursor` CLI from **Cursor → Settings → General → Command Line**.

Docs: <https://docs.cursor.com>

Verify: `cursor --version`

### Connect

```bash
cursor /login
```

kAY.am opens an external terminal for the OAuth flow.

### Disconnect

```bash
cursor /logout
```

### Subscription tier

Requires **Cursor Pro**. kAY.am routes turns through Cursor's subscription-based model cap.

### Summarizer model

`cursor-small` — Cursor's documented cheap-tier alias. The underlying model may change; the alias is stable per Cursor docs.

---

## OpenAI (Codex)

### Install

```bash
npm install -g @openai/codex
```

Docs: <https://github.com/openai/codex>

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

Requires **ChatGPT Pro**. kAY.am uses your subscription cap, not an OpenAI API key.

### Summarizer model

`codex-mini-latest` — OpenAI's cheap-tier alias for Codex. Subject to change as OpenAI publishes a stable mini model id.

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
