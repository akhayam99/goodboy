# Security

> **Read this when** you're reporting a vulnerability, or checking what Goodboy does with user data before a diff ships. **Not for** contributor workflow, which is `CONVENTIONS.md`.

## Reporting a vulnerability

1. Contact the maintainer privately, through the contact info on the [GitHub profile](https://github.com/akhayam99).
2. Include steps to reproduce and your version. Find it under **Goodboy > About**, or in the `.dmg` or Linux package name.

Reports stay private until a fix ships.

## Your data

### No backend

Goodboy runs entirely on your machine. There is no server in the middle, and no telemetry of any kind, from any build. A request to add it is declined.

### Your keys

- API keys live in the OS credential store, never in a file. That store is Keychain on macOS and the freedesktop Secret Service (GNOME Keyring or KWallet) on Linux, which needs to be running for a key to save
- A personal integration key, for GitHub, GitLab, Jira, Bitbucket, Linear or Sentry, or a Slack user token, stays local and is sent only to the service it belongs to
- Conversations and code go only to the providers you connect, over their own CLIs or APIs

### Local storage

- Your session history, settings and usage records live in a SQLite file at `~/.goodboy/data.db`, which you own
- Starting the app only runs pending migrations, and never clears anything
- A local reset is a separate, explicit action: it drops the database and replays the schema from scratch. It never touches the OS credential store

### Network requests

Beyond signing in to a provider, Goodboy reaches the network in two ways:

- A release build checks for its own update against a published manifest. This is the only request Goodboy makes on its own, and only when no provider is connected. A found update is verified before install
- Opening the **Changelog**, pressing **Load image** on an image inside rendered Markdown, or using a crash or boot-error report button each sends one request, and only because you triggered it

## Releases

macOS builds are signed and notarized under the Apple team named in [docs/release.md](./docs/release.md). Verify with `spctl -a -vvv` (expect `accepted, source=Notarized Developer ID`). An autonomous release cycle cannot touch signing material or secrets.

The Linux AppImage, `.deb` and `.rpm` carry no signature and no in-app update. Each new version is a package taken from the release page.

## Under the hood

For contributors touching the files below.

- `~/.goodboy/boot-breadcrumbs.log`: one line per launch, with a timestamp, a launch id (launch time plus process id), the boot phase, and an outcome word, a duration in milliseconds, or both. Phase and detail are checked against a fixed set of allowed values before the line is written, so no argument, environment value, path, response body or credential ever reaches it. Owner-only permissions (`0600`) on macOS and Linux. Past 64 KiB the file rotates to `boot-breadcrumbs.log.1`, keeping at most two
- `apps/desktop/src-tauri/tauri.conf.json`: holds the public key that verifies an update before it installs. The update manifest is `latest.json`, published with the GitHub release. Each window checks once as it opens, then again on focus, on becoming visible, and hourly while visible. Only those later checks are throttled, at least 30 minutes apart per window: the open-time check is not, so an ordinary launch followed by a click into the app can send two requests seconds apart. A development build never checks
- Crash and boot-error report buttons open a prefilled `github.com` issue in the browser, carrying the app version, the error message and, for the crash screen, up to 1,500 characters of the component stack with home folders collapsed to `~` and project or file paths left intact. Title and body travel in the query string, so GitHub receives them as the page loads rather than on submit, and the link is capped at 4,096 bytes, truncating a long message further. Submitting the form is what files the public issue. Closing the tab files nothing. The boot-error link carries its error text as-is, with none of that shortening or cap
- The **Changelog** fetches the release list from `api.github.com`. An image inside rendered Markdown is fetched only after **Load image**, and goes to whatever host that image names
