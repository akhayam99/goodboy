# Security

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/akhayam99/goodboy/security/advisories/new)
so the report stays private until a fix ships. Include steps to reproduce and
the version (`Goodboy > About`, or the name of the dmg or Linux package you
installed). You will get a reply in the
next release cycle at the latest; issues are triaged every cycle.

## What Goodboy does with your data

Goodboy runs entirely on your machine and has no backend. The security
posture follows from that:

- API keys and tokens live in the OS credential store, never in files.
- Conversations and code flow only between you and the providers you
  connected, over their official CLIs or APIs.
- Local persistence is a SQLite file (`~/.goodboy/data.db`) you own.
- No telemetry, analytics or tracking, and requests to add them are refused
  by policy ([docs/autonomy/safety.md](./docs/autonomy/safety.md)).

One honest caveat: a token you paste for an integration (GitHub, GitLab,
Jira, Bitbucket, Linear, Sentry) is stored locally but is sent to that
provider on every request. Local-only storage does not mean the token never
travels to its own service.

## Releases

macOS builds are signed and notarized under the maintainer's Apple team
(`M3R9H4QX65`). Verify a download with `spctl -a -vvv` (expect
`accepted, source=Notarized Developer ID`). Autonomous release cycles cannot
touch signing material or secrets; see [AUTONOMY.md](./AUTONOMY.md).

The Linux AppImage, deb and rpm carry no updater signature, and the release
publishes no update manifest for them, so a Linux build never fetches anything
on its own: every new version is a package you take from the release page.
The OS credential store named above is the Keychain on macOS and the
freedesktop Secret Service on Linux, GNOME Keyring or KWallet, so on Linux a
keyring daemon has to be running before a token can be saved.

Follow-up: the Linux backend is the one the `keyring` crate selects, though no
token has been stored and read back on a Linux desktop yet. If the backend
disagrees, its own error comes back where you saved the token, with the token
not saved.
