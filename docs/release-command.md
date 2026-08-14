# How to release Goodboy

> **Read this when** an agent is executing a release and needs the step
> order plus the gotchas that bit previous runs. **Not for** signing,
> notarization or updater detail (`docs/release.md`).

Agent playbook for cutting a release. When the user says **"release the next
version"**, **"rilascia la prossima minor/patch"**, **"ship the next release"**,
or similar, follow this file end to end. No further instructions needed.

[release.md](release.md) is the technical runbook (signing, notarization,
updater, homebrew). This file is the step order plus the gotchas that bit
previous runs.

## Figure out the version yourself

1. Find the current latest: `gh release list --limit 5` (the one tagged
   `Latest`) and `git tag | sort -V | tail`.
2. Compute the next version from what the user asked: patch by default
   (`0.1.11 -> 0.1.12`), "next minor" resets the patch (`0.1.11 -> 0.2.0`),
   "next major" gives `1.0.0`. Ambiguous means patch, and say so.
3. Confirm the computed target with the user in one line before bumping. An
   autonomous run has no user to ask and arrives with the version already
   decided: it skips this step rather than stalling on it.

Below, `X` is the new version and `X-1` is the current latest.

## Process

1. Apply the version bump across the six places listed in
   [release.md](release.md) → The version bump.
   In the same commit add the `## Goodboy vX` section to `CHANGELOG.md` (see
   "Release notes" below): the build reads its body from there and fails if the
   section is missing.
2. Create the release branch under the branch-naming rule in
   [CONVENTIONS.md](../CONVENTIONS.md). Commit
   `chore(repo): bump version to X`, push, open PR.
3. Wait for ALL CI checks green (`gh pr checks`). Then merge server-side
   (`gh pr merge --squash`). DO NOT advance/checkout/pull local `main`, it
   restarts the app. Use `git fetch origin main` to get the merge SHA, tag that
   SHA directly. NOTE: background poll commands may get killed at the turn
   boundary, so poll CI and builds with a foreground until-loop, not
   `run_in_background`.
4. rc dry-run: `git tag vX-rc.1 <merge-sha> && git push origin vX-rc.1`.
   Wait for `release.yml` to finish green. VERIFY notarization: download the
   dmg, `hdiutil attach`, copy `Goodboy.app` out of the mounted volume, then
   run `spctl -a -vvv` and `codesign -dv --verbose=4` against the copy (expect
   `accepted, source=Notarized Developer ID`; the required team and the
   failure condition are in [release.md](release.md)). Detach. Then delete the
   rc, all three of it:

   ```bash
   gh release delete vX-rc.1 --repo akhayam99/goodboy --yes
   git push origin :refs/tags/vX-rc.1
   git tag -d vX-rc.1
   ```

5. Cut real: `git tag vX <merge-sha> && git push origin vX`. Wait for the build
   to produce the draft release: macOS gives dmg + app.tar.gz + .sig +
   latest.json, Linux gives AppImage + deb + rpm (x86_64, no updater manifest
   and no signatures). Seven assets, and a missing Linux one is a red job, not
   an expected skip.

## Release notes (from source, not memory)

Notes live in `CHANGELOG.md`, written BEFORE the tag exists (step 1), never
edited onto the release after the build.

- Get the ACTUAL merged PRs since `X-1`:
  `gh pr list --state merged --base main --json number,title,mergedAt` filtered to
  `mergedAt` after the `X-1` release timestamp (`gh release view vX-1`).
- READ EACH app-facing PR body (`gh pr view <n> --json title,body`) and write
  ONLY from what those bodies say. NOT commit messages, NOT private memory
  notes (in-flight or planned work, they WILL be wrong). If a PR dropped a
  feature, say so. Promise follow-up work only when the PR commits to it.
- Include only `desktop`/`ui`/`core` PRs in the app notes. Exclude
  `website`/`repo`/`docs` PRs.
- BEFORE writing, read [tone-of-voice.md](tone-of-voice.md) and obey it, its
  "Release notes" section in particular. It is the law here, not a suggestion.

### Format (match the curated changelog of v0.1.7 through v0.1.11)

- Section heading `## Goodboy vX`, no codename (dropped from v0.1.8 on), added
  above the previous one. Under it, a one-line lead summary.
- Each feature is an `### sentence-case heading` with its PR ref(s) in square
  brackets at the START, e.g.
  `### [#1241, #1243] Review a Bitbucket pull request in place`. When
  `CHANGELOG.md` and this doc disagree, match the file and fix this doc.
- Marquee feature first, then the rest in priority order.
- End with `### Fixes` (or `### Smaller fixes`): one bullet per fix, PR ref at
  the end of the line, repeating a PR across bullets when it covered several.

## Finish

6. Once the draft release exists (step 5), its body and `latest.json` are
   already filled in from `CHANGELOG.md`: review the draft, then publish:
   `gh release edit vX --draft=false`, then confirm `homebrew.yml` fires and
   succeeds (`gh run list --workflow=homebrew.yml`).
