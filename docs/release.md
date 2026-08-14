# Release runbook

> **Read this when** you need the technical detail of a release: signing,
> notarization, updater, homebrew. **Not for** the step order an agent
> executes (`docs/release-command.md`).

Reference for what a Goodboy release is made of. The step order an agent
executes lives in [release-command.md](release-command.md) and is the only
place that says what to run and in what order; this file says what the pieces
are and why they behave as they do.

Targets, both attached to the same draft release:

- macOS **universal** `.dmg` (Intel + Apple Silicon), signed + notarized,
  published to GitHub Releases and Homebrew.
- Linux **x86_64** AppImage, `.deb` and `.rpm`, built on `ubuntu-latest` and so
  carrying its glibc floor (Ubuntu 24.04 and Debian 13 upward), with no updater
  manifest and no signatures.

## How it works

- Pushing a tag `v*` triggers `.github/workflows/release.yml`, which builds the
  universal `.dmg` via `tauri-action` and creates a **draft** GitHub Release.
  Signing and notarization run automatically from the six `APPLE_*` secrets; if
  those were ever removed, the build still succeeds and produces an unsigned
  `.dmg`.
- The Linux job attaches `Goodboy_<version>_amd64.AppImage`,
  `Goodboy_<version>_amd64.deb` and `Goodboy-<version>-1.x86_64.rpm` to the same
  draft. The deb's dependency list is derived from the binary by
  `dpkg-shlibdeps` at package time and includes `libc6 (>= 2.39)`, which is what
  pins the floor above. Moving the runner to an older Ubuntu is what lowers it.
- The Linux job publishes **no `latest.json` and no `.sig`**, so in-app updates
  stay macOS-only. A Linux user takes the next package from the release page.
- Publishing the draft triggers `.github/workflows/homebrew.yml`, which bumps
  the cask in the tap.

The git tag is the source of truth for the release name; the version baked into
the build comes from `tauri.conf.json`, so the two must match.

## The version bump

Six places carry the version. They must all match the tag, minus the `v`,
except the website which keeps it:

- `package.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json` (`version`)
- `apps/desktop/src-tauri/Cargo.toml` (`package.version`)
- `apps/desktop/src-tauri/Cargo.lock` (the `goodboy-desktop` package entry;
  `rust.yml` runs `cargo test --locked`, so a stale lock is red CI)
- `website/src/site.ts` (`SITE.version`, keeping the leading `v`, so `v0.1.74`).
  Nothing breaks if it is stale, which is why it gets forgotten: the site just
  advertises an old version.

The release build reads its notes from the `## Goodboy vX` section of
`CHANGELOG.md` and fails if that section is missing, which is why the notes are
written before the tag exists.

## Why the release candidate exists

A tag is what triggers the build, so a build failure on the real tag burns the
official version: the rc dry-run exists to fail in a disposable place instead.
Rc tags and their draft pre-releases are the one deletable release artifact.

A verified rc means Gatekeeper accepts the app from a normal double-click and
`spctl` reports `accepted, source=Notarized Developer ID`. What to run and
when is [release-command.md](release-command.md) step 4.

## Signing and notarization

Signed under the maintainer's **personal Apple Developer Individual** team.

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

`tauri-action` reads these env vars and signs + notarizes with no extra workflow
logic. To rotate the cert: re-export the `.p12` from Keychain Access ("My
Certificates", right-click the Developer ID cert, Export), then
`base64 -i cert.p12 | gh secret set APPLE_CERTIFICATE --repo akhayam99/goodboy`
and update `APPLE_CERTIFICATE_PASSWORD`.

## Auto-update

On launch, packaged builds check
`releases/latest/download/latest.json` via `tauri-plugin-updater`; a newer
version surfaces a "Restart to update" control in the status bar and next to the
sidebar logo. macOS only: the Linux job emits no `latest.json` and no `.sig`, so
nothing tells a Linux build a newer version exists. Adding that means signing
the AppImage with the updater keypair and pointing the plugin at a Linux target.

Update artifacts are signed with a dedicated **updater keypair**, separate from
Apple code-signing. The public key lives in `tauri.conf.json`
(`plugins.updater.pubkey`); the private key and password are the repo secrets
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
`latest.json`'s `notes` field is the same `CHANGELOG.md` section as the release
body.

Because `latest.json` points at `releases/latest`, only a **published** release
is visible to clients. Never remove the pubkey or the plugin without a migration
plan, or installed apps lose the ability to update.

## Homebrew tap

Public install channel: `brew install --cask akhayam99/tap/goodboy`. Homebrew
strips the quarantine attribute on cask install.

1. The public repo `akhayam99/homebrew-tap` holds the cask (the `homebrew-`
   prefix is required; users type `akhayam99/tap`).
2. On publish, the `homebrew` workflow renders the cask from
   `packaging/goodboy.rb` and pushes it to `Casks/goodboy.rb` in the tap.
3. It authenticates with the `HOMEBREW_TAP_TOKEN` secret on `akhayam99/goodboy`
   (fine-grained PAT, `contents: write` on the tap repo).

A `homebrew.yml` failure after publishing is a real failure, not an expected
skip: check the run, fix, re-run before calling the release done. An expired
token is an owner escalation, since rotating secrets is not authorized for
agents.

## Troubleshooting

- **Build fails in the universal step**: most likely the workspace deps were not
  built before `tauri build`. The workflow runs
  `pnpm turbo run build --filter=@goodboy/desktop^...` first; a new workspace
  package must be a dependency of `@goodboy/desktop`.
- **"The specified item could not be found in the keychain"**:
  `APPLE_SIGNING_IDENTITY` must match the cert in `APPLE_CERTIFICATE` exactly,
  including the team ID in parentheses.
- **Notarization auth error**: `APPLE_PASSWORD` must be an app-specific password
  (appleid.apple.com), and `APPLE_ID` / `APPLE_TEAM_ID` must belong to the same
  Individual team.
- **macOS Keychain `.p12` uses legacy RC2-40**: reading it locally with OpenSSL 3
  needs `openssl pkcs12 ... -legacy`. CI uses `security import`, which handles it
  natively.
- **Local reproduction**: `pnpm tauri:build`, or
  `pnpm --filter @goodboy/desktop tauri build --target universal-apple-darwin`
  for the macOS universal artifact. On an x86_64 Linux host `pnpm tauri:build`
  drops the AppImage, deb and rpm. There is no cross-build from macOS.
