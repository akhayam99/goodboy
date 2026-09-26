# How to release Goodboy

> **Read this when** an agent is executing a release and needs the step
> order plus the gotchas that bit previous runs. **Not for** signing,
> notarization or updater detail (`docs/release.md`).

This is the agent's playbook for making a release. When the user says
**"release the next version"**, **"ship the next release"**, or something
similar, follow this file from start to end. You need no other instructions.

[release.md](release.md) is the technical runbook (signing, notarization,
updater, homebrew). This file has the steps in order, plus the gotchas that
caught earlier runs.

## Figure out the version yourself

1. Find the current latest: `gh release list --limit 5` (the one tagged
   `Latest`) and `git tag | sort -V | tail`.
2. Run `node scripts/release-kind.mjs`. It prints `minor` or `patch` with the
   reason, following [versioning.md](versioning.md). Patch is the default
   (`0.1.11 -> 0.1.12`). Minor resets the patch (`0.1.11 -> 0.2.0`) and is
   only for one-way doors, such as a new migration. `1.0.0` only when the
   owner writes "major". Never propose it.
3. If the user asked for a patch, run
   `node scripts/release-kind.mjs --requested patch`. If it exits with an
   error, stop and tell the user which migration or one-way door forces a
   minor.
4. Before bumping, confirm the target version with the user in one line.

Below, `X` is the new version and `X-1` is the current latest.

## Process

1. Apply the version bump in the six places listed in
   [release.md](release.md) → The version bump.
   Bump each file in its own command. One `perl -i -pe '... if $. <= 5'` over
   several files never resets `$.` between them, so every file after the first
   is left unbumped.
   In the same commit, add the `## Goodboy vX` section to `CHANGELOG.md` (see
   "Release notes" below). The build reads its body from there, and fails if
   the section is missing.
2. Create the release branch following the branch-naming rule in
   [CONVENTIONS.md](../CONVENTIONS.md). Commit
   `chore(repo): bump version to X`, push, open PR.
3. Wait until ALL CI checks are green (`gh pr checks`). Then merge on the
   server (`gh pr merge --squash`). Never advance, check out or pull local
   `main` ([AGENTS.md](../AGENTS.md) → Forbidden patterns). Use
   `git fetch origin main` to get the merge SHA, then tag that SHA directly.
4. rc dry-run (a practice release):
   `git tag vX-rc.1 <merge-sha> && git push origin vX-rc.1`.
   Wait for `release.yml` to finish green. VERIFY notarization: download the
   dmg, `hdiutil attach`, copy `Goodboy.app` out of the mounted volume, then
   run `spctl -a -vvv` and `codesign -dv --verbose=4` against the copy. Expect
   `accepted, source=Notarized Developer ID`. The required team and what
   counts as a failure are in [release.md](release.md). Detach. If a Goodboy
   volume is already mounted, `hdiutil attach` mounts the new one at
   `/Volumes/Goodboy 1`. So detach earlier volumes first, and take the mount
   point from the attach output. Then delete the rc in all three places
   (release, remote tag, local tag):

   ```bash
   gh release delete vX-rc.1 --repo akhayam99/goodboy --yes
   git push origin :refs/tags/vX-rc.1
   git tag -d vX-rc.1
   ```

5. Cut the real release: `git tag vX <merge-sha> && git push origin vX`. Wait
   for the build to create the draft release. macOS gives dmg + app.tar.gz +
   .sig + latest.json. Linux gives AppImage + deb + rpm (x86_64, no updater
   manifest and no signatures). That is seven assets. A missing Linux asset is
   a red job, not an expected skip.

## Release notes (from source, not memory)

Notes live in `CHANGELOG.md`. They are written BEFORE the tag exists (step 1),
and never edited onto the release after the build.

- Get the ACTUAL merged PRs since `X-1`:
  `gh pr list --state merged --base main --json number,title,mergedAt`, keeping
  only PRs whose `mergedAt` is after the `X-1` release timestamp
  (`gh release view vX-1`).
- READ EACH app-facing PR body (`gh pr view <n> --json title,body`) and write
  ONLY from what those bodies say. NOT commit messages, NOT private memory
  notes (they hold in-flight or planned work, and they WILL be wrong). If a PR
  dropped a feature, say so. Never promise follow-up work: the notes say what
  ships, see [tone-of-voice.md](tone-of-voice.md).
- Include only `desktop`/`ui`/`core` PRs in the app notes. Exclude
  `website`/`repo`/`docs` PRs.
- BEFORE writing, read [tone-of-voice.md](tone-of-voice.md) and obey it, its
  "Release notes" section in particular. It is the law here, not a suggestion.

### Format (v2, from v0.5.0 on)

Goodboy reads `CHANGELOG.md` packaged into the app (from v0.5.0 on; older
entries fall back to plain markdown). `changelogFormat.test.ts` lints every
release from v0.5.0 on in CI: a release that breaks this contract fails the
build. If `CHANGELOG.md` and this doc disagree, match the file and fix this
doc.

```text
## Goodboy v0.7.0

Plans and reports are saved as files you can open, review fixes land on a branch that moved, and replies to reviewers sound like you.

This version updates your data in one direction. To go back to 0.6, restore the backup Goodboy made before updating.

### New

#### Replies to reviewers in your voice
<!-- gb area=review screen=settings/workspace/review-replies pr=1886 -->

Replies to review comments follow two templates, one for a fix and one for a change you decline, and the agent writes only the reason.

### Fixed

- Learning your reply style skips a provider that reached its usage limit, like other tasks on Auto. <!-- gb area=review pr=1886 -->
```

- Section heading `## Goodboy vX.Y.Z`, exact. Add it above the previous one.
- One opening sentence under the heading: max 160 characters, no PR refs.
- The one-way paragraph is a FIXED sentence, only when the release migrates
  the database, with `X.Y` the previous minor:
  `This version updates your data in one direction. To go back to X.Y, restore
the backup Goodboy made before updating.` Nothing else.
- Then `### New`, `### Improved`, `### Fixed`, in that order, at least one.
  Never `### Fixes`.
- A New/Improved entry is a `#### ` title (sentence case, no PR ref, no
  period, max 60 characters), followed immediately (no blank line) by a
  hidden meta comment: `<!-- gb area=<area> screen=<screen> image=<name>
pr=<numbers> -->` (`area` required, the rest optional, no spaces inside a
  value). Then one or two paragraphs (the first entry of the release may have
  three), max 70 words each.
- A Fixed entry is one line: a bullet, its text (max 30 words), then the meta
  comment at the end, e.g. `- text here <!-- gb area=<area> pr=<numbers> -->`.
- `area` is a closed list: `sessions`, `agents`, `workflows`, `review`,
  `artifacts`, `inbox`, `providers`, `integrations`, `scripts`, `storage`,
  `settings`, `app`. `screen` is a closed list of in-app destinations, see
  `features/changelog/changelogScreens.ts`.
- Never put a PR number in the visible text (no `[#1886]`): it lives only in
  the `pr=` meta. Never link in the prose. `code` only for keys and commands.
- Denylist enforced by the lint: em dash, middot, "follow-up", "not yet",
  "coming soon", "will".

## Finish

6. Once the draft release exists (step 5), its body and `latest.json` are
   already filled in from `CHANGELOG.md`. Review the draft. The real tag is a
   fresh build, so the rc check in step 4 does not cover this dmg. Check
   notarization again on the draft's own dmg:
   `gh release download vX --repo akhayam99/goodboy --pattern 'Goodboy_X_universal.dmg'`,
   `hdiutil attach`, copy `Goodboy.app` out, run `spctl -a -vvv` and
   `codesign -dv --verbose=4` against the copy with the same expectations as
   step 4, then detach. Any failure stops the release here, still a draft.
   Then publish it: `gh release edit vX --draft=false`. Confirm `homebrew.yml`
   starts and succeeds (`gh run list --workflow=homebrew.yml`). Compare
   `shasum -a 256` of the checked dmg with the `sha256` in
   `akhayam99/homebrew-tap` `Casks/goodboy.rb`. They must match, or the cask
   points at a file nobody checked.
