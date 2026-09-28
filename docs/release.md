# Release runbook

> **Read this when** you need the technical detail of a release: signing,
> notarization, updater, homebrew. **Not for** the step order an agent
> executes (`docs/release-command.md`).

This file explains what a Goodboy release is made of. The steps an agent
runs, in order, live in [release-command.md](release-command.md). That file is
the only place that says what to run and when. This file says what the pieces
are and why they behave the way they do.

There are two targets, both attached to the same draft release:

- macOS **universal** `.dmg` (Intel + Apple Silicon), signed + notarized,
  published to GitHub Releases and Homebrew.
- Linux **x86_64** AppImage, `.deb` and `.rpm`, built on `ubuntu-latest`. So
  they need that runner's minimum glibc (Ubuntu 24.04 and Debian 13 or newer).
  They have no updater manifest and no signatures.

## How it works

- Pushing a tag `v*` triggers `.github/workflows/release.yml`. It builds the
  universal `.dmg` with `tauri-action` and creates a **draft** GitHub Release.
  Signing and notarization run on their own from the six `APPLE_*` secrets. If
  those secrets were ever removed, the build would still pass and produce an
  unsigned `.dmg`.
- The Linux job attaches `Goodboy_<version>_amd64.AppImage`,
  `Goodboy_<version>_amd64.deb` and `Goodboy-<version>-1.x86_64.rpm` to the same
  draft. When packaging, `dpkg-shlibdeps` reads the binary and builds the
  deb's dependency list. That list includes `libc6 (>= 2.39)`, and that is what
  sets the minimum above. Moving the runner to an older Ubuntu is the way to
  lower it.
- The Linux job publishes **no `latest.json` and no `.sig`**, so in-app updates
  stay macOS-only. A Linux user takes the next package from the release page.
- Publishing the draft triggers `.github/workflows/homebrew.yml`, which bumps
  the cask in the tap.

The git tag decides the release name. The version built into the app comes
from `tauri.conf.json`. So the two must match.

## The version bump

Five places hold the version. They must all match the tag without the `v`.
The website footer has no copy of its own: it shows the newest snapshot in
`website/src/data/releases/`, which the release PR adds.

- `package.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json` (`version`)
- `apps/desktop/src-tauri/Cargo.toml` (`package.version`)
- `apps/desktop/src-tauri/Cargo.lock` (the `goodboy-desktop` package entry.
  `rust.yml` runs `cargo test --locked`, so an out-of-date lock turns CI red)

The release build reads its notes from the `## Goodboy vX` section of
`CHANGELOG.md`. If that section is missing, the build fails. That is why the
notes are written before the tag exists.

## Why the release candidate exists

The tag is what starts the build. So if the build fails on the real tag, that
official version number is used up. The rc (release candidate) is a practice
run that can fail in a place you can throw away. Rc tags and their draft
pre-releases are the only release artifacts you may delete.

An rc is verified when Gatekeeper accepts the app from a normal double-click
and `spctl` reports `accepted, source=Notarized Developer ID`. The rc proves
the pipeline, not the file you ship. The real tag builds the dmg again, so the
same check runs on the draft's own dmg before it is published, and the cask
sha is compared with that checked file. What to run and when is in
[release-command.md](release-command.md) steps 4 and 6.

## Signing and notarization

The app is signed under the maintainer's **personal Apple Developer
Individual** team.

- Team ID: **M3R9H4QX65**. Any other team id in `codesign` output is a failure.
- Signing identity: `Developer ID Application: Amin Khayam (M3R9H4QX65)`.

Repo secrets on `akhayam99/goodboy` (already set):

| Secret                       | What it is                                              |
| ---------------------------- | ------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Developer ID Application cert, exported `.p12`, base64  |
| `APPLE_CERTIFICATE_PASSWORD` | password for the `.p12`                                 |
| `APPLE_SIGNING_IDENTITY`     | `Developer ID Application: Amin Khayam (M3R9H4QX65)`    |
| `APPLE_ID`                   | Apple ID email for notarytool                           |
| `APPLE_PASSWORD`             | app-specific password for that Apple ID (not the login) |
| `APPLE_TEAM_ID`              | `M3R9H4QX65`                                            |

`tauri-action` reads these env vars, then signs and notarizes with no extra
workflow logic. To rotate the cert, export the `.p12` again from Keychain
Access ("My Certificates", right-click the Developer ID cert, Export). Then run
`base64 -i cert.p12 | gh secret set APPLE_CERTIFICATE --repo akhayam99/goodboy`
and update `APPLE_CERTIFICATE_PASSWORD`.

Both `tauri-action` steps also set `GOODBOY_BUILD_SHA` to the release commit. The
`app_platform` command bakes its first 12 characters into the binary, and bug
reports show them as the build. A local build has no value and reports `dev`.

## Auto-update

On launch, packaged builds check
`releases/latest/download/latest.json` through `tauri-plugin-updater`. If a
newer version exists, the footer's Goodboy chip says "Update ready" and its
popover offers "Restart to update", and an "Update to X" chip shows up in
`WorkspaceLauncher`. Clicking that chip opens an inline confirm anchored to it
(no dialog). It says how many running agents pick up after the restart, links
"What's new" to that release in the changelog, and starts "Download and restart". While the
update downloads, the chip reads "Downloading 42%" (or "Downloading" when the
size is unknown). If the install fails, including a failed relaunch, the
pending update is kept. The chip turns into "Update failed", with the reason
in its tooltip, and the same confirm offers Retry. A notification also offers
Retry, which installs again without a new check. A failed background check
shows no chip and no notification. It shows up in **Settings > App > General**
instead, next to the installed version, the last check time and **Check now**.
The changelog opens on the focused or installed release and marks newer ones
"available".

The changelog bundled in a build (`CHANGELOG.md?raw` in
`features/changelog/changelogSource.ts`) stops at that build's own version, so
it can't describe the update. When a check finds one, `checkForUpdates` starts
`loadChangelogUpcoming` without waiting for it. The `release_changelog` command
(`src-tauri/src/releases.rs`) fetches `CHANGELOG.md` at the update's tag from
raw.githubusercontent.com in Rust, so the webview CSP stays closed. The text
goes through the same `parseChangelog`, and `releasesInUpdate` keeps the
releases after the installed version up to the update, skipped ones included.
The result is kept per target for the session. A failed fetch keeps nothing, so
the next check or open tries again, and until then the changelog falls back to
the update's own notes (`updateNotes`). Pictures in those entries load through
`changelog_image` like any other release.

Installing never relaunches straight away. `relaunchWithResume`
(`store/slices/updater/prepareRestart.ts`) writes `restart.reason` in the
settings table, then calls `restart_prepare`, which records the live turns in
`restart.interrupted_runs` and stops them without sending their end, so no
window settles them as failed. Only then does it relaunch; a failed relaunch
calls `restart_abort`. The next launch resumes those agents and reopens every window
([turns.md](turns.md#surviving-a-reload-or-a-restart),
[navigation.md](navigation.md#addresses-and-history)).

This is macOS only. The Linux job writes no
`latest.json` and no `.sig`, so nothing tells a Linux build that a newer
version exists. Adding it would mean signing the AppImage with the updater
keypair and pointing the plugin at a Linux target.

Update artifacts are signed with their own **updater keypair**, separate from
Apple code-signing. The public key lives in `tauri.conf.json`
(`plugins.updater.pubkey`). The private key and its password are the repo
secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
The `notes` field in `latest.json` is the same `CHANGELOG.md` section as the
release body.

`latest.json` points at `releases/latest`, so installed apps only see a
**published** release. Never remove the pubkey or the plugin without a
migration plan. Otherwise installed apps can no longer update.

## Homebrew tap

The public install command is `brew install --cask akhayam99/tap/goodboy`.
Homebrew removes the quarantine attribute when it installs the cask.

1. The public repo `akhayam99/homebrew-tap` holds the cask (the `homebrew-`
   prefix is required, and users type `akhayam99/tap`).
2. On publish, the `homebrew` workflow renders the cask from
   `packaging/goodboy.rb` and pushes it to `Casks/goodboy.rb` in the tap.
3. It authenticates with the `HOMEBREW_TAP_TOKEN` secret on `akhayam99/goodboy`
   (fine-grained PAT, `contents: write` on the tap repo).

If `homebrew.yml` fails after publishing, that is a real failure, not an
expected skip. Check the run, fix it and re-run it before you call the release
done. An expired token goes to the owner, because agents are not allowed to
rotate secrets.

## Troubleshooting

- **Build fails in the universal step**: most likely the workspace deps were not
  built before `tauri build`. The workflow runs
  `pnpm turbo run build --filter=@goodboy/desktop^...` first. So a new
  workspace package must be a dependency of `@goodboy/desktop`.
- **"The specified item could not be found in the keychain"**:
  `APPLE_SIGNING_IDENTITY` must match the cert in `APPLE_CERTIFICATE` exactly,
  including the team ID in parentheses.
- **Notarization auth error**: `APPLE_PASSWORD` must be an app-specific password
  (appleid.apple.com), and `APPLE_ID` / `APPLE_TEAM_ID` must belong to the same
  Individual team.
- **macOS Keychain `.p12` uses legacy RC2-40**: to read it locally with
  OpenSSL 3, you need `openssl pkcs12 ... -legacy`. CI uses `security import`,
  which handles it out of the box.
- **Local reproduction**: `pnpm tauri:build`, or
  `pnpm --filter @goodboy/desktop tauri build --target universal-apple-darwin`
  for the macOS universal artifact. On an x86_64 Linux host, `pnpm tauri:build`
  writes the AppImage, deb and rpm. You can't build for Linux from macOS.
