# Iconography

> **Read this when** you are about to put a glyph on a surface, or you are
> unsure which glyph a concept already owns. **Not for** color tokens
> (`packages/ui/DESIGN-SYSTEM.md`) or spacing mechanics (`docs/styling.md`).

One meaning, one glyph. The registry in
[`apps/desktop/src/shared/components/conceptIcons.ts`](../apps/desktop/src/shared/components/conceptIcons.ts)
is the contract. `CONCEPT_ICONS` maps a concept to its glyph. `CONCEPT_TONE`
maps the same concept to its tone. `ICON_SIZE` gives the only three sizes the
app draws icons at. This document is the readable version of that file. The
code is right when they disagree: a change to the registry, `LENS_LABEL` or
`LENS_ICON` updates this document in the same pull request.

Rules that hold everywhere:

- Lucide only. Brand marks come from `@goodboy/ui` (`GithubIcon`, `GitlabIcon`,
  `LinearIcon`, `JiraIcon`, `SentryIcon`, `SlackIcon`, `BitbucketIcon`) or from
  `IntegrationGlyph`, never from a lucide look-alike.
- `Sparkles`, `Sparkle`, `Wand2` and `WandSparkles` are banned by
  `apps/desktop/src/__tests__/regressions/no-ai-sparkle-glyphs.test.ts`. An AI
  control uses the glyph of its concept (`orchestrator`, `enhance`,
  `suggestion`, `autorun`, `agents`), not a vague sparkle. Auto in the model
  picker uses `autoRouting` (`Route`).
- Spinners are banned ([DESIGN.md](../DESIGN.md#motion) owns the rule). That
  is why the run-state family below has no glyph for `running`.
- An icon-only control carries a `Tooltip`, enforced by
  `icon-only-controls-carry-a-tooltip.test.ts`.
- Emoji never appear in the UI.

## Sizes

Three tokens, exported from `conceptIcons.ts`:

| Token               | px  | Use                                                    |
| ------------------- | --- | ------------------------------------------------------ |
| `ICON_SIZE.row`     | 13  | Leading and trailing glyphs inside list and table rows |
| `ICON_SIZE.control` | 14  | Buttons, menu triggers, rail tabs, form adornments     |
| `ICON_SIZE.hero`    | 18  | Empty states, studio headers, choice tiles             |

Sizes below the row token (8 to 11 px) stay as plain numbers. They belong to
chips, badges and status dots, where the glyph is a mark inside a shape, not a
row of its own.

`apps/desktop/src/__tests__/regressions/icon-size-uses-a-token.test.ts` fails on
any 12 to 18 px literal under `features/` and `app/`. Every feature area has
already been moved to the tokens. The allowlist holds the one real exception
(an HTML `input size` attribute, counted in characters). A new exception needs
a reason in its allowlist entry, never a waiver for a whole directory.

## Navigation lenses

`LENS_ICON` in `features/session/lens-labels.ts` reads straight from the
registry, so a lens never picks its own glyph, and `LENS_LABEL` in the same
file names it. Size is `control` in the lens switcher. `lensDestinations` in
`features/session/lens-destinations.ts` decides which lenses a session lists.

| Lens (`LENS_LABEL`)         | Concept        | Glyph                   | Tone    | Listed                                     |
| --------------------------- | -------------- | ----------------------- | ------- | ------------------------------------------ |
| Context                     | `context`      | `Brain`                 | info    | always                                     |
| Workflows                   | `workflows`    | `Waypoints`             | primary | always                                     |
| Agents                      | `agents`       | `Bot`                   | primary | always                                     |
| Questions                   | `questions`    | `CircleHelp`            | warning | always                                     |
| Artifacts                   | `plans`        | `ClipboardList`         | draft   | always                                     |
| Review                      | `review`       | `MessageSquareDiff`     | primary | with a branch                              |
| Diff                        | `diff`         | `FileDiff`              | info    | with a branch                              |
| Explore                     | `explore`      | `FolderSearch`          | info    | always                                     |
| Scripts                     | `scripts`      | `ListVideo`             | info    | with a branch                              |
| Terminal                    | `terminal`     | `SquareTerminal`        | neutral | with a branch                              |
| Code host                   | `pr`           | `GitPullRequest`        | primary | with a branch, when the host is not GitHub |
| Linear, GitLab, Jira, Slack | brand concepts | `@goodboy/ui` brand set | primary | with a branch, when that tool is connected |

Goal (`goal`, `Target`), Decisions (`decisions`, `CheckCheck`) and Session
summary (`sessionSummary`, `NotebookText`) are parts of the Context region:
their shortcuts open it, and they have no menu entry of their own. GitHub issue
(`issues`, `CircleDot`) opens from an issue link, never from the switcher.

## Session stages

On the board, a stage is the column heading's tone and the card's shell tint.
The glyph is only for surfaces that explain the stage in prose.
`SESSION_STAGE_ICON` in `features/session/session-stage.ts` owns that mapping.
The stage board section of the guide uses it.

| Stage       | Glyph         | Tone    |
| ----------- | ------------- | ------- |
| `attention` | `CircleHelp`  | warning |
| `running`   | `CirclePlay`  | info    |
| `review`    | `Eye`         | success |
| `building`  | `Hammer`      | neutral |
| `done`      | `CircleCheck` | merged  |

## Agent kinds

Agent kinds do **not** get a lucide glyph. They are shown by the mascot plus
a color per kind in `shared/components/AgentAvatar`, read through
`agentKindPalette({ kind })` in `features/session/agent-kind.ts`. The list of
kinds is `AGENT_KIND_META` in the same file. A second glyph system for the same
kinds would compete with it. Use `AgentAvatar`.

A kind shown as a label always renders through `AgentKindChip`, one tinted
recipe at two densities:

- `label` (default): the fixed-width tinted chip, so a column of chips stays
  lined up (tree rows, the timeline, step and library cards). `label` can
  change the text where a surface names the role instead of the kind.
- `glyph`: the kind avatar at `xs` with the label in a tooltip, for dense
  strips such as preset cards.

Never build a colored role word or an outlined kind chip by hand.

## Run states

| State     | Concept        | Glyph          | Tone    | Used by                                              |
| --------- | -------------- | -------------- | ------- | ---------------------------------------------------- |
| pending   | `runPending`   | `CircleDashed` | neutral | `AgentStatusIcon`                                    |
| running   | none           | pulsing dot    | info    | `StatusDot tone="info" pulsing`                      |
| done      | `runDone`      | `CircleCheck`  | success | `AgentStatusIcon`, run status                        |
| failed    | `runFailed`    | `CircleX`      | danger  | `AgentStatusIcon`                                    |
| cancelled | `runCancelled` | `CircleSlash`  | neutral | `AgentStatusIcon` (skipped), discarded workflow runs |

## Projects, mounts and git objects

| Concept         | Glyph               | Tone    | Meaning                                     |
| --------------- | ------------------- | ------- | ------------------------------------------- |
| `projectRepo`   | `FolderGit2`        | info    | A project whose kind is `repo`              |
| `projectFolder` | `Folder`            | neutral | A project whose kind is `folder`            |
| `mount`         | `Layers2`           | info    | A project mounted into a session            |
| `worktree`      | `FolderTree`        | neutral | The session folder on disk                  |
| `workspace`     | `LayoutGrid`        | info    | A workspace                                 |
| `branch`        | `GitBranch`         | info    | A branch, and the branch chip               |
| `commits`       | `GitCommit`         | info    | Commits                                     |
| `timeline`      | `GitCommitVertical` | neutral | The activity rail                           |
| `pr`            | `GitPullRequest`    | primary | Pull and merge requests                     |
| `diff`          | `FileDiff`          | info    | A diff, and the changes cell of a mount row |
| `folderOpen`    | `FolderOpen`        | neutral | Reveal the worktree in the OS               |

`projectGlyph({ kind })` in `conceptIcons.ts` is the only place that picks
between the repo and the folder glyph. Never work it out again inline.

## Integrations and providers

Brand marks only, never a lucide stand-in. `github`, `gitlab`, `bitbucket`,
`linear`, `jira`, `sentry`, `slack` map to the `@goodboy/ui` brand
components. The footer strip draws them through `IntegrationGlyph`: in brand
color when the integration is connected, muted when it is not. `providers`
(`Blocks`) and `integrations` (`Link2`) name the categories, not a vendor.

## Settings

The settings rail and the panel sections read these, so an item and its
section share one glyph.

| Concept      | Glyph                       | Tone    | Meaning                                      |
| ------------ | --------------------------- | ------- | -------------------------------------------- |
| `appearance` | `Palette`                   | neutral | Settings > App > General, and its Appearance |
| `updates`    | `CircleFadingArrowUp`       | info    | App updates                                  |
| `editor`     | `SquareCode`                | neutral | The default editor                           |
| `shortcuts`  | `Keyboard`                  | neutral | Keyboard shortcuts                           |
| `backup`     | `DatabaseBackup`            | neutral | Config export and import                     |
| `storage`    | `Database`                  | neutral | Local database and archived sessions         |
| `help`       | `MessageCircleQuestionMark` | neutral | Guides, the phone and feedback               |
| `danger`     | `TriangleAlert`             | danger  | A danger zone                                |

## Actions

| Concept        | Glyph                   | Tone    | Affordance                                 |
| -------------- | ----------------------- | ------- | ------------------------------------------ |
| `rename`       | `SquarePen`             | neutral | Rename an agent, workflow, title           |
| `archive`      | `Archive`               | neutral | Archive a session                          |
| `restore`      | `ArchiveRestore`        | neutral | Unarchive a session, on the board card too |
| `delete`       | `Trash2`                | danger  | Destructive delete                         |
| `folderOpen`   | `FolderOpen`            | neutral | Reveal a path in the OS                    |
| `openExternal` | `SquareArrowOutUpRight` | neutral | Open on the code host                      |
| `terminal`     | `SquareTerminal`        | neutral | Open a terminal                            |
| `scripts`      | `ListVideo`             | info    | Open scripts                               |
| `more`         | `Ellipsis`              | neutral | Overflow menu trigger                      |
| `search`       | `SearchX`               | info    | Empty search result                        |

`Ellipsis` replaced the deprecated `MoreHorizontal` alias on every overflow
trigger in the migrated areas.

## Timeline markers

`TimelineRowMarker` draws every fact row as a `WorkNode` marker and sizes its
glyph with `WORK_NODE_GLYPH_SIZE`, not `ICON_SIZE`, because every rail node is
20px on every grade. The glyph itself still comes from the registry through
`sessionEventGlyph`.

| Entry           | Glyph                                     |
| --------------- | ----------------------------------------- |
| Plan            | `plans`                                   |
| Open question   | `questions`                               |
| Answered        | `MessageSquareCheck`                      |
| Branch artifact | `branch`                                  |
| Session folder  | `worktree`                                |
| Project mounted | `mount`                                   |
| Pull request    | `PULL_REQUEST_PRESENTATION` per state     |
| Workflow        | `workflows`, `delete` when deleted        |
| Decisions       | `decisions`                               |
| Issue           | `IntegrationGlyph` for the issue provider |

## Suggestions

One map, `SUGGESTION_ICONS` in `features/suggestions/suggestionIcons.ts`.
The suggestion row and the "Suggested next" strip above NOW in the activity
feed both use it. They used to disagree on four of six kinds.

| Kind                 | Concept     | Glyph                |
| -------------------- | ----------- | -------------------- |
| `workflow-next-step` | `nextSteps` | `ArrowRight`         |
| `plan-ready`         | `plans`     | `ClipboardList`      |
| `resolve-threads`    | `resolve`   | `MessageSquareReply` |
| `rebase-project`     | `branch`    | `GitBranch`          |
| `answer-questions`   | `questions` | `CircleHelp`         |
| `mount-project`      | `mount`     | `Layers2`            |

## Scripts and inbox

Script categories own their glyphs in `SCRIPT_CATEGORIES`
(`features/scripts/classifyScript.ts`): `dev` `Play`, `build` `Hammer`, `test`
`FlaskConical`, `lint` `SearchCheck`, `typecheck` `ShieldCheck`, `format`
`Brush`, `db` `Database`, `generate` `FileCode2`, `install` `Package`, `deploy`
`Rocket`, `clean` `Trash2`, `docs` `BookOpen`, `other` `Terminal`. Import that
list, never restate it.

Inbox rows lead with the tool's brand glyph, never a kind icon. The kind icons
live on the Type facets in `InboxFacetRail.tsx`: `issue` `CircleDot`, pull
requests `GitPullRequest`, `thread` `MessagesSquare`, `error` `Bug`. The state
column draws `InboxStateLabel`: `open` `Circle`, `active` `Contrast`, `done`
`CircleCheck`, `alert` `TriangleAlert`, each in the state tone, always next to
the tool's own state word.
