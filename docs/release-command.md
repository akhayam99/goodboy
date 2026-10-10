# How to release Goodboy

Before release screenshots, run `node scripts/fidelity-shots.mjs` with the website and app scene servers available. It writes paired mock and real-scene PNGs plus measured values for both themes and desktop and phone sizes.

Before a release that touches the activity timeline or Workflows, run `pnpm validate:scenes --app <scene server>` against the mock scene server (`VITE_GOODBOY_MOCK=1`). It opens `activity-run` and `activity-resolves` in Chrome at 100% and 110% zoom and fails on a measure, not a picture: a timeline row that keeps a transform 500ms after its groups open, a group row that moves more than 1px while it opens or folds, a rail stroke that does not continue at the same x into the next row, a gap over 80px between the model and the time, and a time wider than its column, at five widths. It also opens `inbox` and `overview-long-branches` at the same five widths and fails when a task age wraps to a second line or a branch name runs under the put on branch button. It also opens the plan drawer scenes in a 400px card and fails when the toolbar row wraps, runs past its edge or the title takes more than two lines (`--only plan-drawer` runs just these). It also opens Workflows directly and through the app frame, selects Rules through the real control, sends wheel input, and requires the bottom of the page to be reachable. It then opens every scene in `scenes.txt` and opens a sample of its menu triggers (`aria-haspopup="menu"`, a few per kind, each closed before the next) and fails when one opens to fewer than two rows, which is the rule that a menu of one is a quiet button instead (`--only menus` runs just this, `--only <scene>,<scene>` runs it on those scenes). Every failure prints its scene, its check and its details after the `scene measures:` line. Set `VALIDATE_CHROME` when Chrome is not at the default macOS path.

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

1. Apply the version bump in the five places listed in
   [release.md](release.md) → The version bump.
   Bump each file in its own command. One `perl -i -pe '... if $. <= 5'` over
   several files never resets `$.` between them, so every file after the first
   is left unbumped.
   In the same commit, add the `## Goodboy vX` section to `CHANGELOG.md` (see
   "Release notes" below). The build reads its body from there, and fails if
   the section is missing. In the same commit, align the in-app Guide with the
   release (see "Align the in-app Guide" below).
   Give the main visible changes before/after pictures in the same PR. Mount
   the `X-1` tag for `before` and the release branch for `after`, shoot each
   scene with `scripts/changelog-shots.mjs`, and add `image=<name>` to the
   entries. How to shoot, name and cap them is in
   [mock-screenshots.md](mock-screenshots.md) → Pictures for the changelog.
   Then align the public pages with the release, in the same PR:
   - Update `README.md`, the relevant `docs/features/<area>.md`, its index
     entry in `FEATURES.md`, and `website/`: drop what is no longer true and
     add what is new. Edit them in place, never rewrite them from scratch.
   - Every user-facing feature the release adds or changes gets its website
     text updated in the same PR, or a new entry when none tells it yet. The
     website has no captures: its product views are React mocks, so edit the
     mock when the feature changes how the app looks. Re-shoot every figure the
     change made stale in `docs/readme/`, from the mock scenes as
     [mock-screenshots.md](mock-screenshots.md) describes, at a scale of 4 or
     more, in both themes. Feature-area guide figures go to goodboy-media through
     `pnpm features:shots`, at its default scale of 3, in both themes. A
     release that only fixes bugs changes no figure. A release that skips
     the re-shoots leaves them to a docs pass right after it, so no picture
     stays wrong for long.
   - Every figure in `README.md` and `docs/features/` has a caption under its
     `<picture>`, `<sub>Screenshot from Goodboy X</sub>`, so a reader sees how
     old it is. `docs/figures.json` holds the version of each figure. The shot
     scripts write it when they run, and a figure left as it is keeps its
     version. `pnpm run check:doc-refs` fails when a figure has no entry, when
     a caption does not match its entry, or when an entry names no figure.
     `node scripts/check-figure-versions.mjs --write` writes the captions from
     the manifest.
   - Run `node scripts/snapshot-features.mjs X`. It reads the area docs in
     `FEATURES.md` index order and the
     `## Goodboy vX` entry in `CHANGELOG.md`, and writes one JSON file named
     after the version into `website/src/data/releases/`: the feature map the
     site shows for that version, with its New items highlighted, the
     version the site footer shows, and today's date, which dates the
     version's page under `/changelog` and its sitemap entry. Run it after the
     edits above, so the snapshot matches what shipped.
   - Commit the edits and the new JSON in the release PR.
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
   manifest and no signatures), attached by the `attach` job after both
   platform jobs are green. That is seven assets. A missing asset is a red
   job, not an expected skip, and a red run means the draft is not to be
   published.

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
- `image=<name>` names a before/after pair in
  `docs/changelog/<version>/<name>-{before,after}-{dark,light}.webp`, captured
  with `scripts/changelog-shots.mjs <scene> <name> <before|after>` from a
  mock scene: the full 1360×850 window, or the scene's `[data-shot]` element
  when it has one (`docs/mock-screenshots.md`, "Pictures for the changelog").
  Run it once per checkout with `pnpm dev` up in `apps/desktop`, then move
  the files from the `next` staging folder to `docs/changelog/<version>/`. A
  brand-new screen only ever gets an `after` pair. A release that already
  shipped can gain pictures later, in the same folder and under the same
  caps. The app fetches each file from `main` at
  `docs/changelog/<version>/<file>` first, then from the release tag
  `v<version>` when `main` fails, so a picture committed after the tag still
  shows. The app renders it as a 16:10 frame with a
  Before/After switch when both exist, and shows nothing when the picture is
  missing, offline, or unreadable. `scripts/release-notes.mjs` expands it into
  a `<picture>` under the entry when it builds the tagged release's GitHub
  body; the in-app parser ignores that block.

## Align the in-app Guide

The Guide (palette, Open the guide) explains Goodboy chapter by
chapter, in the order a task lives. Its text is in
`apps/desktop/src/features/settings/components/GuideStudio/guideChapters.ts`.

- For each app-facing PR in the release notes, find the chapter it touches.
  Remove what the release made false, add what it made new, and keep each
  chapter short and plain.
- Check every changed sentence against the code, not the PR title. Screen
  names and button labels in the Guide must match the app exactly.
- A chapter link opens a screen through a `GuideTarget`. If the release moved
  or renamed a screen, fix the link.
- Run `pnpm --filter @goodboy/desktop exec vitest run src/features/settings/components/GuideStudio`.

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
