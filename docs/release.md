# Release runbook

Canonical guide for cutting a Goodboy release. **If you are asked to "do a
release", "ship vX.Y.Z", or "cut a release", follow this file end to end.**

Target: macOS **universal** `.dmg` (Intel + Apple Silicon), signed + notarized,
published to GitHub Releases and Homebrew.

## How it works

- Pushing a tag `v*` triggers `.github/workflows/release.yml`, which builds the
  universal `.dmg` via `tauri-action` and creates a **draft** GitHub Release.
- Signing + notarization run automatically because the six `APPLE_*` secrets are
  set on the repo (see "Signing" below). If those secrets were ever removed, the
  build still succeeds but produces an unsigned `.dmg`.
- Publishing the draft release triggers `.github/workflows/homebrew.yml`, which
  bumps the cask in the Homebrew tap.

The git tag is the source of truth for the release name. The version baked into
the build comes from `tauri.conf.json`, so the two must match.

## Step 1: bump the version and write the notes

Set the same version in all four places (they must match the tag, minus the `v`):

- `package.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json` (`version`)
- `apps/desktop/src-tauri/Cargo.toml` (`package.version`)

Add a `## Goodboy vX` section to `CHANGELOG.md` above the previous release (see
`docs/release-command.md` → "Release notes" for the format and sourcing rules).
The release build reads its body from this section and fails if it's missing.

Land the bump on `main` via PR.

## Step 2: dry-run with a release candidate

Never tag the real version first. Validate the pipeline with a throwaway rc, so
a build failure does not burn the official tag.

```bash
git tag v0.1.0-rc.1
git push origin v0.1.0-rc.1
```

This builds the universal `.dmg` and creates a draft pre-release. Then verify:

```bash
# after copying Goodboy.app out of the mounted dmg
spctl -a -vv /Applications/Goodboy.app
# expect: accepted, source=Notarized Developer ID
codesign -dv --verbose=4 /Applications/Goodboy.app  # confirms the signing identity
```

Open the app from a normal double-click: no Gatekeeper warning means signing +
notarization worked. When satisfied, delete the rc:

```bash
gh release delete v0.1.0-rc.1 --repo akhayam99/goodboy --yes
git push origin :refs/tags/v0.1.0-rc.1
git tag -d v0.1.0-rc.1
```

## Step 3: cut the real release

```bash
git tag v0.1.0
git push origin v0.1.0
```

The draft release the workflow creates already has its notes filled in from
`CHANGELOG.md`. Review the draft, then **publish**. Publishing fires the
Homebrew cask bump.

## Signing and notarization

Goodboy is signed under n-bro's **personal Apple Developer Individual** team.

- Team ID: **M3R9H4QX65** (personal). **Do not** use the Serenis org team
  (`FC96QL5F9R`) for this project.
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

The app self-updates via `tauri-plugin-updater`. On launch (packaged builds
only) it checks `releases/latest/download/latest.json`; when a newer version is
found, a "Restart to update" control shows in the status bar and next to the
sidebar logo, and clicking it downloads, installs, and relaunches.

Update artifacts are signed with a dedicated **updater keypair** (separate from
Apple code-signing). The public key lives in `tauri.conf.json`
(`plugins.updater.pubkey`); the private key + password are repo secrets
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
`tauri-action` uses them to sign the `.app.tar.gz` and emit `latest.json`,
which it attaches to the release. `latest.json`'s `notes` field is the same
`CHANGELOG.md` section used for the release body (see "Step 1" above), so the
updater shows the same notes as the GitHub release.

Because `latest.json` points at `releases/latest`, only a **published**
(non-draft) release is visible to clients. The updater config must ship inside a
release for older versions to update to it: never remove the pubkey or the
plugin without a migration plan, or installed apps lose the ability to update.

## Homebrew tap

Public install channel: `brew install --cask akhayam99/tap/goodboy`. For an
unsigned build this would still matter (Homebrew strips the quarantine attribute
on cask install); with notarization it is just the convenient path.

One-time setup (not yet done):

1. Create a public repo `akhayam99/homebrew-tap` (the `homebrew-` prefix is
   required; users type `akhayam99/tap`).
2. The `homebrew` workflow renders the cask from `packaging/goodboy.rb` and
   pushes it to `Casks/goodboy.rb` in the tap.
3. Create a fine-grained PAT with `contents: write` on the tap repo, store it as
   the `HOMEBREW_TAP_TOKEN` secret on `akhayam99/goodboy`.

Until the tap repo + token exist, the `homebrew` job fails (or is skipped);
the GitHub Release itself is unaffected.

## Troubleshooting

- **Build fails in the universal step**: most likely the monorepo workspace deps
  were not built before `tauri build`. The workflow runs
  `pnpm turbo run build --filter=@goodboy/desktop^...` first; if a new workspace
  package was added, confirm it is a dependency of `@goodboy/desktop`.
- **"The specified item could not be found in the keychain" / signing fails**:
  `APPLE_SIGNING_IDENTITY` must match the cert in `APPLE_CERTIFICATE` exactly,
  including the team ID in parentheses.
- **Notarization fails with an auth error**: `APPLE_PASSWORD` must be an
  app-specific password (appleid.apple.com), not the Apple ID login password,
  and `APPLE_ID` / `APPLE_TEAM_ID` must belong to the same Individual team.
- **macOS Keychain `.p12` uses legacy RC2-40**: reading it locally with OpenSSL 3
  needs `openssl pkcs12 ... -legacy`. The CI runner uses `security import`, which
  handles it natively, so this only affects local verification.
- **Local manual build** to reproduce CI: `pnpm tauri:build`. For the universal
  artifact: `pnpm --filter @goodboy/desktop tauri build --target universal-apple-darwin`.
