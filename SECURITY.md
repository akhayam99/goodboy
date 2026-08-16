# Security

> **Read this when** you're reporting a vulnerability, or checking what Goodboy does with user data before a diff ships. **Not for** contributor workflow, which is `CONVENTIONS.md`.

## Reporting a vulnerability

GitHub private vulnerability reporting is not enabled on this repository yet.
Until it is, reach the maintainer through the contact info on the
[GitHub profile](https://github.com/akhayam99). Include steps to reproduce
and the version (`Goodboy > About`, or the dmg/Linux package name). Issues
are triaged every release cycle; expect a reply by the next one.

Once [GitHub private vulnerability reporting](https://github.com/akhayam99/goodboy/security/advisories/new)
is live, prefer it: reports stay private until a fix ships.

## What Goodboy does with your data

Goodboy runs entirely on your machine, no backend:

- API keys and tokens live in the OS credential store, never in files.
- Conversations and code flow only between you and the providers you
  connected, over their official CLIs or APIs.
- Local persistence is a SQLite file (`~/.goodboy/data.db`) you own.
- Every launch appends boot diagnostics to `~/.goodboy/boot-breadcrumbs.log`: a
  timestamp, a launch id (launch time plus process id), the boot phase, and an
  outcome word, the milliseconds that phase took, or both. Nothing else reaches
  the file, because the phase and the detail are both matched against a fixed
  set of allowed values before the line is written: no arguments, environment
  values, paths, response bodies or credentials. On macOS and Linux the file is
  owner-only (`0600`). Past 64 KiB it is renamed to `boot-breadcrumbs.log.1`
  and a fresh file starts, so at most two are kept.
- A release build checks for its own updates, and that is the only reason
  Goodboy touches the network with no provider connected: it fetches the update
  manifest `latest.json` published with the GitHub releases. Each window checks
  once as it opens, and after that when it regains focus, when it becomes
  visible again, and hourly while it stays visible. Only those later checks are
  spaced, at least 30 minutes apart and counted per window; the check at open is
  not, so an ordinary launch followed by a click into the app sends two requests
  seconds apart. A development build never checks. The request carries no data
  about you or your machine, and any update it finds is verified against the
  public key in `apps/desktop/src-tauri/tauri.conf.json` before it is installed.
- No telemetry, of any kind, ever. Adding it is refused whoever asks.

Caveat: a token you paste for an integration (GitHub, GitLab, Jira,
Bitbucket, Linear, Sentry) is stored locally but sent to that provider on
every request. Local-only storage does not mean the token never travels.

Starting the app only runs pending migrations; it never clears anything. A
local reset is an explicit action: it drops the database contents and replays
the schema from scratch, and it touches nothing outside that file. It never
deletes API keys from the OS credential store.

## Releases

macOS builds are signed and notarized under the Apple team named in
[docs/release.md](./docs/release.md). Verify with `spctl -a -vvv` (expect
`accepted, source=Notarized Developer ID`). Autonomous release cycles cannot
touch signing material or secrets.

The Linux AppImage, deb and rpm carry no updater signature and the release
publishes no update manifest entry for them: a Linux build is never offered an
update, and every new version is a package taken from the release page.
The OS credential store is the Keychain on macOS, and on Linux the
freedesktop Secret Service (GNOME Keyring or KWallet), so a keyring daemon
must be running before a token can be saved there.

Follow-up: the Linux backend is whichever the `keyring` crate selects; no
token has been stored and read back on a Linux desktop yet. If the backend
disagrees, its own error comes back and the token is not saved.
