# Release runbook

How to cut a Goodboy release. Target: macOS universal `.dmg` (Intel + Apple
Silicon), published to GitHub Releases and Homebrew.

## Cut a release

1. Land everything for the release on `main`.
2. Bump the version in all four places (they must match):
   - `package.json`
   - `apps/desktop/package.json`
   - `apps/desktop/src-tauri/tauri.conf.json` (`version`)
   - `apps/desktop/src-tauri/Cargo.toml` (`package.version`)
3. Tag and push:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. The `release` workflow builds the universal `.dmg` and creates a **draft**
   GitHub Release. Review it, write the notes, then publish.
5. Publishing the release triggers the Homebrew cask bump (once the tap is
   wired, see below).

The tag is the source of truth for the release name. The version inside the
build comes from `tauri.conf.json`, so keep step 2 in sync with the tag.

## Homebrew tap

Public install channel: `brew install --cask akhayam99/tap/goodboy`. For an
unsigned app this matters: Homebrew strips the quarantine attribute on cask
install, so the app opens with no Gatekeeper prompt.

One-time setup:

1. Create a public repo `akhayam99/homebrew-tap` (the `homebrew-` prefix is
   required; users type `akhayam99/tap`).
2. Add `Casks/goodboy.rb` (template in this repo: `packaging/goodboy.rb`).
3. Create a fine-grained PAT with `contents: write` on the tap repo, store it
   as the `HOMEBREW_TAP_TOKEN` secret in `akhayam99/goodboy`.

The release workflow's `homebrew` job computes the `.dmg` sha256 and pushes the
updated cask to the tap on each published release.

## Signing and notarization (future)

v0.1 ships unsigned. To remove the Gatekeeper friction on direct downloads,
enroll an **Individual** Apple Developer Program membership (personal Apple ID,
not the Serenis org team) and add these repo secrets:

| Secret                          | What it is                                          |
| ------------------------------- | --------------------------------------------------- |
| `APPLE_CERTIFICATE`             | Developer ID Application cert, exported `.p12`, base64 |
| `APPLE_CERTIFICATE_PASSWORD`    | password for the `.p12`                             |
| `APPLE_SIGNING_IDENTITY`        | e.g. `Developer ID Application: Name (TEAMID)`      |
| `APPLE_ID`                      | Apple ID email for notarytool                       |
| `APPLE_PASSWORD`                | app-specific password for that Apple ID             |
| `APPLE_TEAM_ID`                 | 10-char Team ID                                     |

`tauri-action` reads these env vars and signs + notarizes automatically. No
workflow logic changes beyond passing the secrets through `env:`.
