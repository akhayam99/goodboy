# Security

> **Read this when** you want to report a vulnerability, or check what Goodboy does with your data before a change ships. **Not for** how to contribute. That is in `CONVENTIONS.md`.

## Reporting a vulnerability

1. Write to the maintainer privately. The contact info is on the [GitHub profile](https://github.com/akhayam99).
2. Add the steps to reproduce and your version. You find the version under **Goodboy > About**, or in the name of the `.dmg` or Linux package.

Your report stays private until a fix ships.

## Your data

### No backend

Goodboy runs only on your machine. There is no server in the middle. No build sends telemetry of any kind. The website at goodboy-ai.dev counts page views with Vercel's cookieless analytics, which keeps no cookie and no identifier. The app is not involved.

### Your keys

- API keys live in your system's password store, never in a file. On macOS that is Keychain. On Linux it is the freedesktop Secret Service (GNOME Keyring or KWallet), and it has to be running for a key to save
- Personal keys for your tools stay on your machine. That covers GitHub, GitLab, Jira, Bitbucket, Linear and Sentry keys, and a Slack user token. Each one goes only to the service it belongs to
- Your conversations and code go only to the providers you connect, through their own CLIs or APIs
- **Settings › App › Security findings** scans the text Goodboy keeps for you (saved scripts, workflow prompts, your profile, reply templates, permission rules) for anything shaped like a key or a token, on your Mac only; it never sends that text anywhere
- **Settings › App › Backup** exports your setup (workspaces, projects, profile, workflows, scripts, permission rules, budget rules, linked integrations without credentials, app preferences) to a JSON file, never your API keys, tokens, sign-ins, sessions, transcripts, artifacts, worktree folders, usage history or notifications. Folder paths are off by default because they contain your username. Any group with an open security finding is left out of the export until you choose to include it. The file is written with owner-only permissions (`0600`)

### Local storage

- Your session history, settings and usage records live in one SQLite file at `~/.goodboy/data.db`. The file is yours
- When the app starts, it only applies pending database updates (migrations). It never deletes anything
- A local reset is a separate action you choose on purpose. It deletes the database and builds it again from zero. It never touches your system's password store

### Network requests

Apart from signing in to a provider, Goodboy goes online in two cases:

- A release build checks for its own updates against a published list of versions (the manifest). This is the only request Goodboy makes without you asking, and only when no provider is connected. Goodboy verifies an update before it installs it, and downloads that release's changelog pictures in the background at the same time, cached under `~/.goodboy/cache/changelog` (30 MB cap, oldest release evicted first)
- Some actions send one request each, and only because you clicked them. These are opening the **Changelog** (it fetches release dates only, and downloads a picture for the release you are viewing if it is not already cached; the notes themselves are packaged with the app), pressing **Load image** on an image inside rendered Markdown, and sending a bug report. While you type a report with GitHub connected, the sheet also searches the open Goodboy issues for a match, half a second after you stop typing

### Bug reports

A report goes to the public Goodboy issue tracker on GitHub, so it carries only what helps find the problem: the one line you write (and the detail, if you add one), the context below, and the error when there is one. From the crash screen, the error message and at most 8 frames of Goodboy's own stack and 8 of the component stack, with library frames dropped. From a startup error, the startup step that failed and its message. From **Report this** on a notification, that notification's title and text. The crash line starts as `Crash:` plus the kind of error, never its message.

Every part the app attaches is a chip in the report sheet, and a click leaves it out. **What gets sent** shows the exact text before it leaves, with the number of redactions. Your line and detail lose any token, but are otherwise sent as you wrote them.

Where it goes depends on your GitHub connection:

- **Connected**: **Send** files the issue with `gh issue create` under your account, and the toast links it. While you type, the sheet searches the open issues with `gh search issues`, sending your line through the filter below; **Add mine there** adds your report as a comment with `gh issue comment` instead of a new issue
- **Not connected**: **Open on GitHub** opens a prefilled issue form in your browser. Title and body travel in the link, so GitHub receives them when the page loads, and nothing is filed until you submit there. The link is capped at 4,096 bytes; when the report is longer, the link carries what fits and the whole report is copied to your clipboard first, for you to paste

Every piece of text the app puts into a report passes through one filter before it leaves. The filter:

- Removes keys and tokens (GitHub, Anthropic, OpenAI, Slack, GitLab, AWS, JWT) and any value after words like `authorization`, `bearer`, `api key`, `token`, `password` or `secret`
- Shortens every path under your home folder to `~/…/<file name>`, dropping your username and every folder name. Paths on external volumes and in temporary folders are shortened the same way. Your username is also removed wherever else it appears
- Replaces email addresses with `[email]`, and ids and IP addresses with `[id]` and `[ip]`
- Keeps only the host of a web address, never its path, query or fragment. Addresses on your own machine or network become `[url]`
- Replaces the names of your projects, repositories and branches with numbered placeholders, when the report knows them

When a report attaches context, that context is a fixed list, and each item passes through the same filter:

- The app version and the build it came from (a short commit id, or `dev` for a local build)
- Your system: macOS or Linux, its version number, and the processor type
- The screen you were on, as a label such as `Session › Review`. Never a session id, a name or a path
- The version of each provider CLI Goodboy found, such as `Claude CLI 2.1.260`

The context carries nothing else: no log files, no session content, no action history, no ids, no project or repository names, no screenshots.

When Goodboy hits an error it does not recover from (an uncaught error or rejected promise in the window, or a panic in the app process), it keeps one record in `~/.goodboy/last-crash.json`, readable only by you (`0600`). The record holds the error message and at most 8 of Goodboy's own stack frames, the screen label, the app version and the time. The window side filters it through the same rules as a report before writing; the app process side keeps only the first line of the panic message with your home folder replaced by `~`, and only frames from Goodboy's own code, never file paths or environment values. Nothing is sent. On the next launch one toast offers **Report it**, which opens the report sheet with the crash attached for you to review; **Dismiss** or reporting deletes the file, the toast shows once, and a record older than 7 days is deleted unseen.

What never leaves: log files, session content, prompts and replies, transcripts, diffs, the clipboard, environment variables and your system's password store. The app never reads them to build a report. What removal cannot promise: a secret in a format the app does not know passes through, and text you type in the report form is sent as you wrote it. Read the preview before you send.

### Pairing a phone

Pairing a phone opens a listener on your local network, and only when you open the pairing studio. It listens on every network interface, on a random port. If you close the studio with no phone paired, the listener stops. Once a phone is paired, it stays up until you quit or press **Disconnect**. A phone joins by scanning a one-time code that expires after 60 seconds, then completing an encrypted Noise XK handshake. Paired phones are kept in an allow list on this machine. A paired phone can send messages, start agents and workflows, resolve review comments and merge pull requests, so pairing a phone lets it run agents on this machine. **Disconnect** forgets every paired phone at once. Details are in [docs/companion.md](./docs/companion.md).

## Releases

macOS builds are signed and notarized by Apple, under the team named in [docs/release.md](./docs/release.md). To check a build, run `spctl -a -vvv`. You should see `accepted, source=Notarized Developer ID`. The automated release process has no access to signing keys or secrets.

The Linux AppImage, `.deb` and `.rpm` are not signed and do not update from inside the app. To get a new version, download the package from the release page.

## Under the hood

For contributors who change the files below.

- `~/.goodboy/boot-breadcrumbs.log` gets one line per launch. Each line has a timestamp, a launch id (launch time plus process id), the startup phase, and an outcome word, a duration in milliseconds, or both. Phase and detail must match a fixed list of allowed values before the line is written. So no argument, environment value, path, response body or credential can end up in the file. Only the owner can read it (`0600`) on macOS and Linux. Past 64 KiB the file moves to `boot-breadcrumbs.log.1`, and at most two files are kept
- `apps/desktop/src-tauri/tauri.conf.json` holds the public key that verifies an update before it installs. The update manifest is `latest.json`, published with each GitHub release. Each window checks once when it opens. It checks again when it gets focus, when it becomes visible, and every hour while visible. Only those later checks wait at least 30 minutes between each other, per window. The check on open does not wait, so a normal launch followed by a click into the app can send two requests a few seconds apart. A development build never checks
- `apps/desktop/src/shared/utils/redactReport.ts` is the filter described in **Bug reports**. Its test corpus lists the cases it must hold. A new kind of report text goes through it, never around it
- `apps/desktop/src/features/settings/reportContext/` builds the report context. `ReportContext` is the list above; adding a field means adding its label and its redaction test, or the build fails. The system line comes from the `app_platform` command in `apps/desktop/src-tauri/src/app_platform.rs`, which reads the compile target and `sw_vers` on macOS or `uname -r` on Linux, and the build id from `GOODBOY_BUILD_SHA`, set by the release workflow
- `apps/desktop/src/features/bug-report/reportBody.ts` is the one body builder: every report, from the sheet, a notification, the crash screen or a startup error, is built there from its parts, and the preview shows that same text. The notification, error and stack parts pass through `redactReport` with the names of your workspaces, projects and repositories; the line and the detail pass through `redactSecrets`. `trimStack` keeps only Goodboy's own frames. `reportDestination.ts` runs the three `gh` calls (`issue create`, `issue comment`, `search issues`) against `akhayam99/goodboy` only. The fallback link has no template and no labels. Only submitting the form files the public issue; closing the tab files nothing
- `apps/desktop/src-tauri/src/last_crash.rs` owns `~/.goodboy/last-crash.json`. `last_crash_write` accepts only the window sources, caps the message at 1,000 characters, the stack at 4,000 and the screen at 120, keeps at most 10 action names made of letters, digits, dots, dashes and underscores (none are sent today), and never overwrites an unshown record. The panic hook writes the `rust` record itself. `last_crash_claim` hands a record out once and marks it shown, so a second window never repeats the toast; `last_crash_delete` removes it. `apps/desktop/src/features/bug-report/crashReport.ts` (`installCrashCapture`) filters the window record with `redactReport` and `trimStack` before the write
- `.github/workflows/issue-type-label.yml` labels a new issue `bug`, `idea` or `question` from its `Type:` line. It runs `gh` with `issues: write` only, reads the body through an environment variable, never checks out code, and uses no third-party action
- The **Changelog** reads its notes from `CHANGELOG.md`, packaged with the app: all releases are available offline. It fetches only the publish date of each release from `api.github.com`, merged in over the packaged text. Missing dates while offline show without a message. A release entry's before/after picture, when it has one, downloads from `raw.githubusercontent.com`, from `main` first and from that release's own tag when `main` fails, and is cached under `~/.goodboy/cache/changelog/<version>`; offline, or when the picture is missing or unreadable, the block simply does not appear, with no placeholder and no message. An image inside rendered Markdown loads only after you press **Load image**, and the request goes to whatever host that image points to
