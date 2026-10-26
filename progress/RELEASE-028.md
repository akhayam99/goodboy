# RELEASE-028

## Round 2: merge main and clear CodeQL

Merged origin/main (25 commits past 0.27.15) into ak/release-0.28.0 with a merge commit. CHANGELOG.md and version files did not conflict.

### Conflicts

- GoodboyMenu.tsx: kept the stage's `shared/utils/names` path and main's `isDirectedScene` use.
- isDirectedScene.ts: main's GoodboyChip now imports it from production code, which the production-graph test forbids under MockScene. Moved to `shared/utils/isDirectedScene.ts`, importers updated.
- DemoRailNote, DemoStageLoading, DemoTopBar: main's copy and structure, with the stage's `text-meta` role in place of `text-label`.
- DemoStage.tsx, useSceneDirector/index.ts: kept the stage's AbortController listeners and `readDemo*` parsers, added main's theme message, shortcut command and theme subscription. The `stageBackdrop` import the stage no longer has was dropped.
- isDemoHintReport.ts (deleted by the stage, modified by main): stayed deleted; main's `focus` and `isClicked` fields ported into `readDemoHintReport`.
- readDemoThemeMessage, readDemoShortcutCommand (new in main): rewritten on `readDemoEnvelope`. `isDemoTheme` replaced by `readDemoThemeValue({ value })`.
- autoTimeline.ts: main's `simulatedSpawn` fallthrough with the stage's `satisfies` form.
- DemoPlayground.test.tsx: main's "Step 1 of 6" names, stage's bare `getByRole` style.

### Fixes after the merge

- param-shape: markMatches, createResultTracker, syncDemoLinks now take destructured params.
- Hand-written Tauri mocks in createHintEngine.dwell, installDemoStudios and guideHints tests now use the harness factories.
- groupHints.twin.test.tsx: `resetScene` reinstalls the scene invoke stub after each mid-test store reset.

### CodeQL

- homebrew.yml: top-level `permissions: contents: read`.
- fake_cli_tests.rs: dropped the argv message from the `--trust` count assert so no argv is printed.

### Gates

- `pnpm gate` (full): ok, 2174s.
- a11y: 7 files, 1099 tests, all passed.
- self-review: 4 found, 4 fixed.
