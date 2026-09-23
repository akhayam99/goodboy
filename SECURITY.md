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

### Local storage

- Your session history, settings and usage records live in one SQLite file at `~/.goodboy/data.db`. The file is yours
- When the app starts, it only applies pending database updates (migrations). It never deletes anything
- A local reset is a separate action you choose on purpose. It deletes the database and builds it again from zero. It never touches your system's password store

### Network requests

Apart from signing in to a provider, Goodboy goes online in two cases:

- A release build checks for its own updates against a published list of versions (the manifest). This is the only request Goodboy makes without you asking, and only when no provider is connected. Goodboy verifies an update before it installs it
- Some actions send one request each, and only because you clicked them. These are opening the **Changelog**, pressing **Load image** on an image inside rendered Markdown, and the buttons that report a crash or a startup error

### Pairing a phone

Pairing a phone opens a listener on your local network, and only when you open the pairing studio. It listens on every network interface, on a random port, until you quit or press **Disconnect**. A phone joins by scanning a one-time code that expires after 60 seconds, then completing an encrypted Noise XK handshake. Paired phones are kept in an allow list on this machine. A paired phone can send messages, start agents and workflows, resolve review comments and merge pull requests, so pairing a phone lets it run agents on this machine. **Disconnect** forgets every paired phone at once. Details are in [docs/companion.md](./docs/companion.md).

## Releases

macOS builds are signed and notarized by Apple, under the team named in [docs/release.md](./docs/release.md). To check a build, run `spctl -a -vvv`. You should see `accepted, source=Notarized Developer ID`. The automated release process has no access to signing keys or secrets.

The Linux AppImage, `.deb` and `.rpm` are not signed and do not update from inside the app. To get a new version, download the package from the release page.

## Under the hood

For contributors who change the files below.

- `~/.goodboy/boot-breadcrumbs.log` gets one line per launch. Each line has a timestamp, a launch id (launch time plus process id), the startup phase, and an outcome word, a duration in milliseconds, or both. Phase and detail must match a fixed list of allowed values before the line is written. So no argument, environment value, path, response body or credential can end up in the file. Only the owner can read it (`0600`) on macOS and Linux. Past 64 KiB the file moves to `boot-breadcrumbs.log.1`, and at most two files are kept
- `apps/desktop/src-tauri/tauri.conf.json` holds the public key that verifies an update before it installs. The update manifest is `latest.json`, published with each GitHub release. Each window checks once when it opens. It checks again when it gets focus, when it becomes visible, and every hour while visible. Only those later checks wait at least 30 minutes between each other, per window. The check on open does not wait, so a normal launch followed by a click into the app can send two requests a few seconds apart. A development build never checks
- The crash and startup-error report buttons open a prefilled `github.com` issue in the browser. The issue carries the app version and the error message. From the crash screen it also carries up to 1,500 characters of the component stack, with home folders shortened to `~` and project or file paths left as they are. Title and body travel in the link's query string, so GitHub receives them when the page loads, not when you submit. The link is capped at 4,096 bytes, which cuts a long message shorter. Only submitting the form files the public issue. Closing the tab files nothing. The startup-error link sends its error text as it is, with no shortening and no cap
- The **Changelog** loads the list of releases from `api.github.com`. An image inside rendered Markdown loads only after you press **Load image**, and the request goes to whatever host that image points to
