Goodboy
=======

**Stop re-explaining yourself.**

[CI](https://github.com/akhayam99/goodboy/actions/workflows/ci.yml) · [Latest release](https://github.com/akhayam99/goodboy/releases/latest)

Goodboy is an open-source desktop workspace for coding agents on macOS and
Linux. It keeps the goal, decisions and running summary of a task on your disk,
outside any provider's chat. Stop Claude halfway, hand the task to Codex, come
back tomorrow: nobody re-explains anything.

No account, no server.

[Get a release](https://github.com/akhayam99/goodboy/releases/latest) · [goodboy-ai.dev](https://goodboy-ai.dev) · [Read the documentation](./docs/README.md)

What you can do
---------------

- Your task's goal, decisions and running summary live in one SQLite file on
  your disk. The next agent is briefed from it, not by you.
- Every turn is rebuilt from the stored task, not resumed from a provider's
  session file. That is what lets a task move from Claude to Codex. Agents keep
  separate conversations.
- Home is a board, not a chat window. Six columns: building, running, needs
  you, in review, done, archived. Open a card to get the plans, questions and
  diff for that task.
- Workflows are reusable step sequences with one provider, model and effort
  per step, so a scouting step can run on a cheaper model than planning. Steps
  run in sequence.
- Usage is metered locally and you can set a budget per provider.

Goodboy calls the container for a task a session. Each project gets its own git
worktree when the session needs it, with the reason recorded. Agents work in a
worktree, not in your checkout, and several sessions run at once without
fighting over the same files. A session can bring several projects together as
the work reaches them.

Plans are artifacts with their own lifecycle, rather than messages buried in a
conversation. You can also hand the work to VS Code or Cursor. A resolver can
address one review comment with a local commit, but it does not push it.

Install
-------

On macOS, install the signed and notarized universal build with Homebrew:

```bash
brew install --cask akhayam99/tap/goodboy
```

You can instead download the `.dmg` from the
[latest release](https://github.com/akhayam99/goodboy/releases/latest) and move
Goodboy to Applications. Homebrew upgrades the cask with:

```bash
brew upgrade --cask goodboy
```

Linux releases are x86_64 AppImage, `.deb` and `.rpm` packages:

```bash
sudo apt install ./Goodboy_<version>_amd64.deb
sudo rpm -i Goodboy-<version>-1.x86_64.rpm
chmod +x Goodboy_<version>_amd64.AppImage
```

Linux needs `libc6 >= 2.39`. Credentials use the freedesktop Secret Service, so
GNOME Keyring, KWallet or another compatible daemon must be running before you
save a personal API key. Windows has no installer and currently requires a
source build.

Providers and integrations
--------------------------

Goodboy connects to Claude, Cursor, Codex, Gemini through Antigravity,
OpenCode, OpenRouter and Moonshot. Claude, Cursor and Codex log in with the CLI
you already use. OpenCode ships models that need no key. OpenRouter and
Moonshot take an API key, and one `opencode` binary serves all three. Installation,
authentication and provider-specific behavior are in
[the provider guide](./docs/providers.md).

GitHub, GitLab, Bitbucket, Jira, Linear, Sentry and Slack can connect to the
workspace. Each integration covers part of its service, not its whole API.
Keys are stored in the operating system credential store. Agents reach these
services through the documented [query bridge](./docs/query-bridge.md).

Current limits
--------------

- Workflow steps run sequentially. Scout fan-out does not make workflow steps
  run in parallel.
- Linear can write descriptions and comments, but it cannot assign issues or
  change their status. Sentry is read-only. Slack has contract tests, but has
  not been exercised against a live workspace.
- Windows requires a source build and has no signed installer.
- Linux packages require `libc6 >= 2.39` and a running Secret Service for
  credentials.

Local data and network use
--------------------------

No account, no server. The task context, settings and local usage records live
in SQLite on your machine. Provider routing and usage metering also run there.
The app carries no telemetry.

Provider calls and connected services still leave the machine. Prompts and
responses go to the provider you choose, and requests to GitHub, Linear or
another connected service go to that service. A release build checks GitHub
for updates. If the app stops rendering, it can open an opt-in crash-report
prefill link in your browser. Nothing is filed unless you submit the issue.

[SECURITY.md](./SECURITY.md) documents credentials, diagnostics, update checks,
crash-report contents and the distinction between the desktop app and website.

If Goodboy disappeared tomorrow, your data would be untouched, because it was
never ours.

Run from source
---------------

You need Node 20 or newer, pnpm 10.33.4 and a working Rust toolchain. Install
the workspace and start the Tauri development app:

```bash
pnpm install
pnpm tauri:dev
```

A production build uses `pnpm tauri:build`. CI currently builds with Node 22.
Read the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for
platform packages and [desktop development notes](./apps/desktop/README.md) for
the local loop.

The app uses Tauri 2, React 19, TypeScript, Zustand and SQLite in a pnpm and
Turborepo monorepo.

Documentation and contributing
------------------------------

Start with the [documentation index](./docs/README.md). The deeper references
cover [concepts](./docs/concepts.md), [workflows](./docs/workflows.md),
[providers](./docs/providers.md), the [query bridge](./docs/query-bridge.md) and
[architecture](./docs/architecture.md).

If something breaks, feels off or is missing, [open an issue](https://github.com/akhayam99/goodboy/issues/new).
Half-formed thoughts welcome, and "this feels wrong" is a valid bug report.
Before changing code, read [AGENTS.md](./AGENTS.md) and
[CONVENTIONS.md](./CONVENTIONS.md).

Read this page when you want the product, setup and present boundaries. It is
not the working-conventions reference.

Contributors
------------

[Amin Khayam](https://github.com/akhayam99) · [Luca Laudiero](https://github.com/teckperry)

License
-------

[MIT](./LICENSE) © Amin Khayam
