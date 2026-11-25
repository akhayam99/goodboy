# Iconography

> **Read this when** you are about to put a glyph on a surface, or you are
> unsure which glyph a concept already owns. **Not for** color tokens
> (`packages/ui/DESIGN-SYSTEM.md`) or spacing mechanics (`docs/styling.md`).

One meaning, one glyph. The registry in
[`apps/desktop/src/shared/components/conceptIcons.ts`](../apps/desktop/src/shared/components/conceptIcons.ts)
is the contract. `CONCEPT_ICONS` maps a concept to its glyph. `CONCEPT_TONE`
maps the same concept to its tone. `ICON_SIZE` and `ICON_WEIGHT`, in
`packages/ui/src/iconSize.ts` and imported from `@goodboy/ui`, give the only
five sizes and the weights the app draws icons with. This document is the readable version of that file. The
code is right when they disagree: a change to the registry, `LENS_LABEL` or
`LENS_ICON` updates this document in the same pull request.

Rules that hold everywhere:

- Carbon only (the IBM Carbon Design System icon library), imported from
  `@goodboy/ui/icons`. That module re-exports each Carbon glyph under the name
  the code uses (`Ellipsis` draws Carbon `overflow-menu--horizontal`, served as
  `OverflowMenuHorizontal`), one generated file each in
  `packages/ui/src/icons/generated/`, so a glyph lands only in the chunk that
  draws it. To add a glyph, add its line to `packages/ui/src/icons/index.ts` and
  run `pnpm icons:glyphs`; `pnpm check:glyphs` fails when a generated file is
  stale. Brand marks come from `@goodboy/ui` (`GithubIcon`,
  `GitlabIcon`, `LinearIcon`, `JiraIcon`, `SentryIcon`, `SlackIcon`,
  `BitbucketIcon`) or from `IntegrationGlyph`, never from a look-alike glyph.
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

Five tokens, exported from `@goodboy/ui`:

| Token               | px  | Weight  | Use                                                    |
| ------------------- | --- | ------- | ------------------------------------------------------ |
| `ICON_SIZE.mark`    | 10  | bold    | A glyph inside a chip, a dot or an xs control          |
| `ICON_SIZE.row`     | 12  | bold    | Leading and trailing glyphs inside list and table rows |
| `ICON_SIZE.control` | 14  | regular | Buttons, menu triggers, rail tabs, form adornments     |
| `ICON_SIZE.notice`  | 16  | regular | The tone icon of a `Notice`                            |
| `ICON_SIZE.hero`    | 18  | regular | Empty states, studio headers, choice tiles             |

A glyph with no weight draws regular. `iconWeightOf({ size })` gives the weight
of a size; `IconButton` and the folded rail's buttons draw with it. A check mark
takes `ICON_WEIGHT.check` (bold) at any size, a starred star the fill weight.
The generator reads the 32 unit Carbon artboard and scales it to the 256 grid,
so a Carbon line (2 units of 32) is 16 units, and joins every shape of a glyph
into one path. Bold is the regular outline widened by a round 8 unit stroke (24
units on the 256 grid instead of 16). Only `Star` carries fill (Carbon
`star--filled`); any other glyph asked for fill draws regular. Carbon has no
duotone, so the emphasized timeline marker (plan, report, wireframe) draws
bold. A new fill use adds the glyph and its Carbon filled icon to
`FILL_SOURCES` in `scripts/generate-glyphs.mjs`. Paths are rounded to whole
units of the 256 grid, under 0.04px at 18px.
A test asks `findGlyph` (`@goodboy/ui/icons/testing/findGlyph`) whether an svg
draws a glyph at any weight, since a generated svg carries no class.
Import one spelling per
glyph: `TriangleAlert`, `CircleAlert`, `CircleX`, `CircleCheck` and
`SquareArrowOutUpRight` (the older aliases of those glyphs and the plain external-link glyph are
banned by `lucide-one-spelling-per-glyph.test.ts`). Failure has three glyphs, one place
each: `CircleAlert` in a `Notice` of tone danger, `TriangleAlert` in a danger
zone, `CircleX` for a failed run. `ArrowUpRight` means open in a larger view and
never an external link.

Every token is even. Badges and icon boxes are even (`size-5`, `size-9`,
`WorkNode` at 20 px), so an odd glyph lands on a half pixel and looks off
centre. `WorkNode` centres its glyph in a full-size flex box with no line
height, and draws the svg as a block so it never sits on a text baseline.

`mark` is the one rung below the row token: the glyph is a mark inside a shape
(a chip, a badge, a status dot), not a row of its own. There is no 8, 9, 11 or
13 px icon. A number on an icon is never written: `scale-rules.test.ts` counts
every numeric `size=` on an icon tag (a brand mark such as `DogMascot` or
`IntegrationGlyph`, and an HTML `input size`, are not icons) and
`icon-size-uses-a-token.test.ts` fails on any 12 to 18 px literal under
`features/` and `app/`. The allowlist holds the one real exception (an HTML
`input size` attribute, counted in characters). A new exception needs a reason
in its allowlist entry, never a waiver for a whole directory.

## Navigation lenses

`LENS_ICON` in `features/session/lens-labels.ts` reads straight from the
registry, so a lens never picks its own glyph, and `LENS_LABEL` in the same
file names it. Size is `control` in the lens switcher. `lensDestinations` in
`features/session/lens-destinations.ts` decides which lenses a session lists.

| Lens (`LENS_LABEL`)         | Concept        | Glyph                   | Tone    | Listed                                     |
| --------------------------- | -------------- | ----------------------- | ------- | ------------------------------------------ |
| Context                     | `context`      | `Library`               | info    | always                                     |
| Runs                        | `runs`         | `Route`                 | primary | always                                     |
| Agents                      | `agents`       | `Bot`                   | primary | always                                     |
| Questions                   | `questions`    | `CircleHelp`            | warning | always                                     |
| Artifacts                   | `plans`        | `ClipboardList`         | draft   | always                                     |
| Review                      | `review`       | `MessageSquareQuote`    | primary | with a branch                              |
| Diff                        | `diff`         | `FileDiff`              | info    | with a branch                              |
| Explore                     | `explore`      | `FolderSearch`          | info    | always                                     |
| Scripts                     | `scripts`      | `ListVideo`             | info    | with a branch                              |
| Terminal                    | `terminal`     | `SquareTerminal`        | neutral | with a branch                              |
| Pull request                | `pr`           | `GitPullRequest`        | primary | with a branch, when the host is not GitHub |
| Linear, GitLab, Jira, Slack | brand concepts | `@goodboy/ui` brand set | primary | with a branch, when that tool is connected |

Runs reads `CONCEPT_ICONS.runs` (`Route`), so the switcher, the column and
Search or run draw one glyph for it. `Waypoints` stays the glyph of a workflow run
row in the feed. Artifacts keeps `CONCEPT_ICONS.plans` (`ClipboardList`).

Goal (`goal`, `Target`), Decisions (`decisions`, `CheckCheck`) and Session
summary (`sessionSummary`, `NotebookText`) are parts of the Context region:
their shortcuts open it, and they have no menu entry of their own. GitHub issue
(`issues`, `CircleDot`) opens from an issue link, never from the switcher.

## Session stages

On the board, a stage is the column heading's tone and the card's shell tint.
The glyph is only for surfaces that explain the stage in prose.
`SESSION_STAGE_ICON` in `features/session/session-stage.ts` owns that mapping.
The stage board section of the guide uses it.

| Stage       | Glyph                         | Tone    |
| ----------- | ----------------------------- | ------- |
| `attention` | `CircleHelp`                  | warning |
| `running`   | `CirclePlay` (`stageRunning`) | info    |
| `review`    | `Eye`                         | success |
| `building`  | `Hammer`                      | neutral |
| `done`      | `CircleCheck`                 | merged  |

The left column draws a session's state as one `StatusMark` (`sessionMarkOf`):
a bare glyph for what asks you (`MessageCircleQuestionMark`, `Hand`,
`TriangleAlert`), a ring for what moves, a circled glyph for what settled,
never a glyph inside a ring; packages/ui/DESIGN-SYSTEM.md → Status marks has the
table. The folded rail, the pinned rows, the switcher, the hover card, the
Board card signal, the Now chip rows, the palette's Needs you rows and the
Guide legend draw the same `StatusMark`, never a concept icon and never a
`WorkNode`: a state has one glyph and one tone. Sessions in the bar is the one
exception: a row that needs you draws an amber `dot` mark and a running row a
blue one, with the same sentence as label, while a red `failed` mark stays
(`switcherDotOf`). The mark follows the reason that
holds the session, from `ATTENTION_REASON_META` in
`features/session/session-stage.ts` through `attentionMarkOf`, which gives each
reason one mark, one tone and one sentence. Red
`failed` is only an agent error, a stopped run, a push that failed (`push-failed`, "1 comment didn't go out") and failing checks. Amber is what you must
answer, approve or act on: `question` for a question or a comment that needs you, the
hand for a tool permission (Needs permission), a held plan (the plan needs approval), a ready step, a Slack reply and the Lead (Lead needs you), and `alert` for changes
requested and comments the fix could not fix. A solid green disc with a white
check (`approved`) is a pull request ready to merge. A Bitbucket session wears
the same marks: its commit statuses and its reviewers feed the same table, so a
failed status is red, a reviewer's changes request is amber and an approval beside
a failed status never reads ready. A pull request in the merge
queue (`pr-queued`) is the `merging` mark: a ring in the `primary` blue around a
half-filled core, calm and in progress, because nothing is left for you to do.
It ranks below the needs-you reasons and above approved, and the session stays
in review, so it never enters Needs you, the Now chip or the Needs you
rows of Search or run. A finished session is the `merged` check in violet; a
session whose pull request closed unmerged keeps the faint slash (`closed`).
Blue is moving or new: the running ring, and the small dot of an unread reply.
The sentence is the mark's accessible label. DESIGN-SYSTEM.md owns the full table.

## Agent kinds

Each agent kind has one glyph and one color, both on its entry in
`AGENT_KIND_PALETTE` (`icon`, `fg`, `bg`) in `features/session/agent-kind.ts`,
read through `agentKindPalette({ kind })`. A kind the app does not know falls
back to `Bot` in the muted tone. Where a kind means the same thing as a concept,
it reuses the concept glyph: report, wireframe, resolver (`resolve`) and
rewriter (`history`) and Auto (`auto`, `Orbit`, in the `agent-auto` color). The rest are their own: scout `Telescope`, planner
`MapIcon`, implementer `CodeXml`, debugger `BugPlay`, tester `FlaskConical`,
reviewer `ScanEye`, PR reviewer `GitPullRequestArrow`, docs `BookOpen`, scribe
`Feather`, generalist `Bot`. Kinds have no mascot drawing and no bare colored
dot.

A kind always renders through `AgentKindChip`
(`shared/components/AgentKindChip`), one tinted recipe at two densities:

- `label` (default): the app `Chip` at `3xs`, tinted in the kind tone, with
  the kind glyph and the name, hugging its word (tree rows, step and library
  cards, question rows, the spend list, the quick actions). `label` can change
  the text where a surface names the role instead of the kind.
- `glyph`: the kind glyph alone in an 18px tinted circle, with the label in a
  tooltip and the accessible name, for dense strips such as preset cards. It
  is also the role mark of every agent row in the Activity feed (launch, step,
  subagent and chained child), before the title and at every row width. The
  word, with the step position, the model and the effort, lives in the hover
  card that opens after the pointer rests 500ms on the glyph (`i` on the
  focused row opens it) and in the accessible name of the row ("Implementer,
  Sonnet 5.5, High"). A step with no role, whose name no role fits, draws no
  glyph: a guessed Generalist is worse than none.

A workflow row in the feed carries the same circle in a neutral tint with the
glyph the New menu uses: `workflows` (`Waypoints`) for a
preset or custom run, `orchestrator` (`Network`) for an orchestrated one, and
never the word Workflow. The origin (Preset run, Custom run) is the tooltip and
the accessible name.
The scouts', reviewers' and testers' tints sit close together, so the shape of
the icon has to carry the difference, not the colour.

A picker that already prints the kind name (the role select, the create-agent
tiles) leads with the bare kind glyph in the kind tone instead of a chip.
Never build a colored role word or an outlined kind chip by hand.

## Run states

| State     | Concept        | Glyph          | Tone    | Used by                                               |
| --------- | -------------- | -------------- | ------- | ----------------------------------------------------- |
| pending   | `runPending`   | `CircleDashed` | neutral | `AgentStatusIcon`                                     |
| running   | none           | pulsing dot    | info    | `StatusDot tone="info" pulsing`                       |
| done      | `runDone`      | `CircleCheck`  | success | `AgentStatusIcon`, run status                         |
| failed    | `runFailed`    | `CircleX`      | danger  | `AgentStatusIcon`                                     |
| blocked   | `runBlocked`   | `OctagonAlert` | warning | `AgentStatusIcon`                                     |
| cancelled | `runCancelled` | `CircleSlash`  | neutral | `AgentStatusIcon` (skipped), discarded workflow runs  |
| stopped   | `runStopped`   | `CirclePause`  | neutral | agent you stopped, stopped step, `AgentStoppedNotice` |

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
| `history`       | `GitGraph`          | info    | Rewrite history of a branch, never a clock  |
| `timeline`      | `GitCommitVertical` | neutral | The activity rail                           |
| `pr`            | `GitPullRequest`    | primary | Pull and merge requests                     |
| `diff`          | `FileDiff`          | info    | A diff, and the changes cell of a mount row |
| `folderOpen`    | `FolderOpen`        | neutral | Reveal the worktree in the OS               |

`projectGlyph({ kind })` in `conceptIcons.ts` is the only place that picks
between the repo and the folder glyph. Never work it out again inline.

## Integrations and providers

Brand marks only, never a glyph stand-in. `github`, `gitlab`, `bitbucket`,
`linear`, `jira`, `sentry`, `slack` map to the `@goodboy/ui` brand
components. Tasks source facets draw them through `IntegrationGlyph`: in brand
color when the integration is connected, muted when it is not. `providers`
(`Blocks`) and `integrations` (`Link2`) name the categories, not a vendor.

## Settings

The settings rail and the panel sections read these, so an item and its
section share one glyph.

| Concept      | Glyph                       | Tone    | Meaning                                     |
| ------------ | --------------------------- | ------- | ------------------------------------------- |
| `appearance` | `Palette`                   | neutral | Settings > Look and alerts, and Appearance  |
| `updates`    | `CircleFadingArrowUp`       | info    | App updates                                 |
| `editor`     | `SquareCode`                | neutral | The default editor                          |
| `shortcuts`  | `Keyboard`                  | neutral | Keyboard shortcuts                          |
| `backup`     | `DatabaseBackup`            | neutral | Config export and import                    |
| `storage`    | `Database`                  | neutral | Local database and archived sessions        |
| `sessions`   | `SquareKanban`              | primary | A session: the Board door and Search or run |
| `help`       | `MessageCircleQuestionMark` | neutral | Guides, the phone and feedback              |
| `danger`     | `TriangleAlert`             | danger  | A danger zone                               |

## Actions

| Concept        | Glyph                   | Tone    | Affordance                                                                          |
| -------------- | ----------------------- | ------- | ----------------------------------------------------------------------------------- |
| `rename`       | `SquarePen`             | neutral | Rename an agent, workflow, title                                                    |
| `archive`      | `Archive`               | neutral | Archive a session                                                                   |
| `restore`      | `ArchiveRestore`        | neutral | Unarchive a session, on the board card too                                          |
| `refresh`      | `RefreshCw`             | neutral | Re-read a session's mounts and requests                                             |
| `delete`       | `Trash2`                | danger  | Destructive delete                                                                  |
| `folderOpen`   | `FolderOpen`            | neutral | Reveal a path in the OS                                                             |
| `openExternal` | `SquareArrowOutUpRight` | neutral | Open on the code host                                                               |
| `terminal`     | `SquareTerminal`        | neutral | Open a terminal                                                                     |
| `scripts`      | `ListVideo`             | info    | Open scripts                                                                        |
| `more`         | `Ellipsis`              | neutral | Overflow menu trigger, the only overflow glyph (28 square in a header, 24 in a row) |
| `search`       | `SearchX`               | info    | Empty search result                                                                 |

`Ellipsis` replaced the deprecated `MoreHorizontal` alias on every overflow
trigger in the migrated areas.

## Timeline markers

`TimelineRowMarker` draws every fact row as a `WorkNode` marker and sizes its
glyph with `WORK_NODE_GLYPH_SIZE`, not `ICON_SIZE`, because every rail node is
20px on every grade. The glyph itself still comes from the registry: an event
through `sessionEventGlyph`, every other row kind through `activityRowConcept`
(`features/session/timeline/activityRowConcept.ts`), the one map from an
Activity row kind to its concept. The run glyph (`RUN_KIND_GLYPH`) and the
**Needs you** rows read the same function, and `activityRowConcept.test.ts`
pins every kind and every event to a registry glyph.

| Entry           | Glyph                                                        |
| --------------- | ------------------------------------------------------------ |
| Plan            | `plans`                                                      |
| Open question   | `questions`                                                  |
| Answered        | `questionAnswered` (`MessageSquareCheck`)                    |
| Explained       | `learning` (`BookOpen`)                                      |
| Issue linked    | `issueLink` (`Link2`)                                        |
| Issue unlinked  | `issueUnlink` (`Link2Off`)                                   |
| Project removed | `projectDetach` (`FolderMinus`)                              |
| Branch artifact | `branch`                                                     |
| Session folder  | `worktree`                                                   |
| Project mounted | `mount`                                                      |
| Pull request    | `PULL_REQUEST_PRESENTATION` per state                        |
| Workflow        | `workflows`, `delete` when deleted                           |
| Needs you       | `resolve`, the run's glyph, `agents`, `questions`, `history` |
| Decisions       | `decisions`                                                  |
| Issue           | `IntegrationGlyph` for the issue provider                    |

## Row states

A quiet final state in the state slot of a work row is an icon in its tone
(`ICON_SIZE.control`), with the word in the tooltip and the accessible name.
The table is `statePresentation.ts` in `features/workTreeModel/`. States that
ask you or report trouble stay words and have no icon.

| State      | Glyph          |
| ---------- | -------------- |
| Pushed     | `push`         |
| Resolved   | `CheckCheck`   |
| Accepted   | `Check`        |
| Reply only | `Reply`        |
| Skipped    | `SkipForward`  |
| Closed     | `runCancelled` |

## Suggestions

One map, `SUGGESTION_ICONS` in `features/suggestions/suggestionIcons.ts`.
The suggestion row and the verb of a board row above Activity
both use it. They used to disagree on four of six kinds. A Next card whose
primary starts an agent swaps this glyph for the role icon in the role color
(`agentKindPalette`); the map stays the glyph of every other
suggestion and of Search or run.

| Kind                 | Concept     | Glyph                |
| -------------------- | ----------- | -------------------- |
| `workflow-next-step` | `nextSteps` | `ArrowRight`         |
| `plan-ready`         | `plans`     | `ClipboardList`      |
| `resolve-threads`    | `resolve`   | `MessageSquareReply` |
| `rebase-project`     | `branch`    | `GitBranch`          |
| `answer-questions`   | `questions` | `CircleHelp`         |
| `mount-project`      | `mount`     | `Layers2`            |

## Scripts and Tasks

Script rows carry no category glyph. Their actions use `Play` to run, `Square`
to stop and `RotateCw` to restart a service (`features/scripts/components/ScriptRow/`);
a suggested script offers `Pin`.

Tasks rows lead with the tool's brand glyph, never a kind icon. The kind icons
live on the Type facets in `InboxFacetRail.tsx`: `issue` `CircleDot`, pull
requests `GitPullRequest`, `thread` `MessagesSquare`, `error` `Bug`. The 16px
status column of a Tasks row draws the glyph of `INBOX_STATE_PRESENTATION`
alone, named by the tool's own state word: `open` `Circle`, `active` `Contrast`,
`done` `CircleCheck`, `alert` `TriangleAlert`, each in the state tone. The issue
pane writes the word next to the same glyph.

## Search results

A search hit leads with the glyph of its kind, from `SEARCH_KIND_META`
(`features/search/searchKindMeta.ts`), which reads the registry: a session
`sessions`, an agent `agents`, a plan `plan`, a report `report`, a wireframe
`wireframe`, a decision `decisions`, a question `questions`, an issue
`issues`, a pull request `pr` and a branch `branch`. A message is the
`message` concept, `MessageSquareText` in neutral: a line someone wrote, not
a comment thread (`comments`).
