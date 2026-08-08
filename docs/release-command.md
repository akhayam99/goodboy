# How to release Goodboy

Agent playbook for cutting a release. When the user says **"release the next
version"**, **"rilascia la prossima minor/patch"**, **"ship the next release"**,
or similar, follow this file end to end. No further instructions needed.

`docs/release.md` is the technical runbook (signing, notarization, updater,
homebrew). This file is the step order plus the gotchas that bit previous runs.

## Figure out the version yourself

1. Find the current latest: `gh release list --limit 5` (the one tagged
   `Latest`) and `git tag | sort -V | tail`.
2. Compute the next version from what the user asked:
   - "next patch" / "next version" (default): bump the patch, `0.1.11 -> 0.1.12`.
   - "next minor": bump the minor, reset patch, `0.1.11 -> 0.2.0`.
   - "next major": `0.1.11 -> 1.0.0`.
     If the request is ambiguous, default to a patch bump and say so.
3. Confirm the computed target with the user in one line before bumping.

Below, `X` is the new version and `X-1` is the current latest.

## Process

1. Bump `X-1` -> `X` in ALL 6 files: `package.json`,
   `apps/desktop/package.json`, `apps/desktop/src-tauri/tauri.conf.json`,
   `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/Cargo.lock`
   (the `goodboy-desktop` package entry), and `website/src/site.ts`
   (`SITE.version`, which keeps the leading `v`: `vX`). In the same commit, add the `## Goodboy
vX` section to `CHANGELOG.md` (see "Release notes" below): the release
   build reads its body from there and fails if the section is missing, so this
   is not optional.
2. Branch `ak/chore-release-vX` (NOT the worktree codename; see branch-naming
   convention). Commit `chore(repo): bump version to X`, push, open PR.
3. Wait for ALL CI checks green (`gh pr checks`). Then merge server-side
   (`gh pr merge --squash`). DO NOT advance/checkout/pull local `main`, it
   restarts the app. Use `git fetch origin main` to get the merge SHA, tag that
   SHA directly. NOTE: background poll commands may get killed at the turn
   boundary, so poll CI and builds with a foreground until-loop, not
   `run_in_background`.
4. rc dry-run: `git tag vX-rc.1 <merge-sha> && git push origin vX-rc.1`.
   Wait for `release.yml` to finish green. VERIFY notarization: download the dmg,
   `hdiutil attach`, run `spctl -a -vvv` (expect `accepted, source=Notarized
Developer ID`) and `codesign -dv --verbose=4` (expect team `M3R9H4QX65`; any
   other team is a failure). Detach. Then delete the rc (release + remote tag +
   local tag).
5. Cut real: `git tag vX <merge-sha> && git push origin vX`. Wait for the build
   to produce the draft release (dmg + app.tar.gz + .sig + latest.json).

## Release notes (from source, not memory)

Notes live in `CHANGELOG.md`, written BEFORE the tag exists (step 1 above), not
edited onto the release after the build. `.github/workflows/release.yml` reads
the `## Goodboy vX` section verbatim as both the GitHub release body and the
in-app updater's `latest.json` notes, and fails the build if that section is
missing.

- Get the ACTUAL merged PRs since `X-1`:
  `gh pr list --state merged --base main --json number,title,mergedAt` filtered to
  `mergedAt` after the `X-1` release timestamp (`gh release view vX-1`).
- READ EACH app-facing PR body (`gh pr view <n> --json title,body`). Write notes
  ONLY from what the PR bodies actually say. Do NOT use git commit messages, do
  NOT use any `memory/MEMORY.md` project notes (they describe in-flight/planned
  work and WILL be wrong). If a PR dropped a feature, say so. Do not promise
  follow-up work or migrations unless the PR itself commits to it.
- Include only `desktop`/`ui`/`core` PRs in the app notes. Exclude
  `website`/`repo`/`docs` PRs.
- BEFORE writing, read `docs/tone-of-voice.md` and obey it, in particular its
  "Release notes" rules: headings name the capability and never personify it
  ("Pull requests carry the queued check state", not "The pull request tells
  the truth"); the headline feature gets a lead line plus at most three short
  paragraphs, every other feature one or two, a fix one line; limits go inside
  the sentence that promises the thing; work not yet exercised against a live
  service is a one-line follow-up, never "not verified". Plus the standing
  rules: no "AI", no em-dashes, no fluff/minimizers/superlatives, no "bring
  your own X", sentence-case headings, no trailing period on headings/list
  items.

### Format (match the curated changelog of v0.1.7 through v0.1.11)

- Section heading: `## Goodboy vX`. NO codename (release names were dropped
  from v0.1.8 on). Add the new section above the previous one (newest first).
- Right under the heading, a one-line lead summary of the release.
- Each feature is an `### sentence-case heading` with its PR ref(s) in square
  brackets at the START of the heading, e.g.
  `### [#1241, #1243] Review a Bitbucket pull request in place`. This matches
  what `CHANGELOG.md` actually does; when the file and this doc disagree,
  match the file and fix this doc.
- Lead with the marquee feature, then the rest in priority order.
- End with a `### Fixes` (or `### Smaller fixes`) section: one bullet per fix,
  each with its PR ref at the end of the line. The same PR can repeat across
  bullets if it covered several fixes.

## Finish

6. Once the draft release exists (step 5), its body and `latest.json` are
   already filled in from `CHANGELOG.md`: review the draft, then publish:
   `gh release edit vX --draft=false`, then confirm `homebrew.yml` fires and
   succeeds (`gh run list --workflow=homebrew.yml`).
