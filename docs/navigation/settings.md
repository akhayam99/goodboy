# Settings

> **Read this when** you change the Settings studio: its scopes rail, a page, a setting row, Search settings, Restore defaults and Copy from, Storage or the security findings. **Not for** providers and integrations, which live in Connections ([connections.md](connections.md)), or the studio frame ([studios.md](studios.md)).

## A page with its own scopes rail

- The 40px band holds `‹ Back to app` with its Esc hint and no crumb; its segments
  are in [trails.md](trails.md#studio-trails).
- `SettingsScopesLayout` draws a `StudioRailLayout` named Settings scopes
  (`placement="page"` beside the column, `chrome` on Home): the fold control and
  `Search settings` in its first row, the groups or matching settings under it,
  the page as the detail (`data-settings-detail`).
- The rail folds like every page rail (`goodboy:studio-rail-folded:settings:v1`)
  and by itself under 880px of page; the folded strip keeps Show and a Search icon
  that opens the rail on the field. With no saved choice it starts folded in a
  window under 1200px (`foldedByDefaultBelow`); a saved choice always wins.
- The detail is a container (`detailClassName="@container"`): under 600px a Models
  row drops its description and keeps the model, the effort and the Auto or Pinned
  chip.
- The Settings row in the foot is lit while open. Back to app, Esc and Back land
  alike, and a session key (⌃Tab, ⌥⌘↓, ⌘⇧[) or any column row closes Settings on
  its way.

## Settings opens on a page, never on a grid

The door, ⌘, and Search or run land on the page opened last, in memory only
(`lastSettingsFocus`, slice `settings-last-page`).

- The first open after launch lands on Look and alerts (id `general`); a
  remembered page that no longer exists (a workspace page with no workspace, a
  removed provider, the old Runs page) falls back to it (`resolveSettingsFocus`).
- A link that names a page (a scope, a section, a provider, a tool) opens it.
  `scope: 'home'` is the alias for "the last page"; `SettingsStudio` resolves it
  once and amends the history entry to the concrete page.
- Status lines are read once per studio (`useSettingsStatus`, on the minute clock of
  `useNow`). Opening Settings loads nothing beyond one `bridge_status` read: no
  storage scan, no branch scan, no provider refresh.

### The rail is the only index

Two groups named by scope, This Mac (caption every workspace) and the workspace
name (caption this workspace), from `settingsDirectory`; nothing but settings pages
sits in it. Without a workspace the workspace group is one line asking you to open
one.

- Every row is one 28px line (`SettingsNavRow`): a group row carries its icon, a
  page row is nested by `PANE_RHYTHM.navRail.nest`, and no row has a second line, a
  count or an identity.
- A row that needs something shows a 6px dot named by its sentence (Update needed,
  Signed out, Can't check, Not confirmed, Refused your runs, Error, Claude is about
  to run out). The sentence lives on the page: a provider about to run out opens on
  a notice (`ProviderAttentionNotice`).

### Search

- Every page is a Search or run entry (`settingsPaletteEntries`, `Settings: Storage
and search`, `Providers: Claude`, `Workspace settings: Models`) from the same
  list. Every setting row has a key in one registry (`settingRows.ts`: label, help,
  page, band, former names), listed in ⌘K too, tagged `Setting` with "Page · Band";
  ⌘K leaves out Pair an iPhone, already a command.
- `Search settings` (`settingsSearchHits`, `SettingsSearchResults`) lists matching
  pages, then rows (label before former name before help), in place of the groups.
  Arrows move, Return opens, Esc clears (`useSettingsSearch`). No match says `No
setting matches "x".` and points to ⌘K.
- A row pick opens its page on the same entry with `row` in the focus; the row
  scrolls into view and lights for a moment (`useSettingRowAnchor`, fed by
  `SettingRowFocusContext` inside `SettingRow` through its `rowKey`; `FieldRow`
  takes `anchor` and `isHighlighted`), then the focus drops `row`. A workspace field
  row finds its key by field (`settingRowKeyOfField`).

## Pages

One page per job. The panel shows one item at a time and enters with `nav-step-in`
(`SETTINGS_PANE_ENTRY`), so no scope adds a second rail column; every panel keeps
the reading width.

### This Mac

These pages sit under their heading whatever scope is active, so switching scope
never moves a row under the pointer (`appSections.ts`).

| Page                  | Id         | Holds                                                                                                  |
| --------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| Look and alerts       | `general`  | Appearance, Notifications, the Updates band (version, What's new, background download), the update dot |
| Editor, terminal, git | `devtools` | Open with, Built-in terminal, Git; `advanced` is its alias                                             |
| Keyboard shortcuts    |            | the shortcut groups                                                                                    |
| Storage and search    | `storage`  | Storage, ending with the Search band                                                                   |
| Backup and reset      |            | ends with Delete all data                                                                              |

- The old `updates` id opens Look and alerts at its Updates band; a remembered
  `updates` page reopens it plain.
- Old names stay search aliases (General, Advanced, Git, Search index), and every
  band keeps its name.
- iPhone stays out of the rail until `useIsIphonePaired` reads a paired phone (or
  while its page is open); both searches still list it.

### This workspace

Projects, About you, Models, Permissions, Branches, Replies and commits sit under
the workspace name (`workspacePages.ts`, `SettingsRailPageGroup`), ending on one
quiet link row, **Run defaults are in Workflows** (`SettingsRailLink`, `isLink`).

- A page carries its title and one line of help; every part is a `Band` with one
  heading style (eyebrow, icon, hint) and help under each field, never in a
  tooltip. Only the page on screen mounts.
- **Models** (`models`): `workspacePageOf` maps it and every model row id to it,
  `PlanPage` leaves it out of copy and restore, and its title's meta line names the
  workspace (`DefaultsPanel` `scopeLabel`).
- Old anchors (`projects`, `profile`, `after-merge`, `review-replies`,
  `permissions`, `danger`) pick a page (`workspacePageOf`); `general` hands off to
  Every run; `track-with-git` (and `dev-project`) lands on Projects with the first
  commit review of the first plain code folder open.
- **Replies and commits** is one column: `How replies read` (the voice, its
  preview, `Sign replies`, then `Reply wording`, a closed disclosure with the two
  templates and an `Insert` popover each that puts a placeholder at the caret,
  `ReplyTemplatesBand`), `After a reply` (`Resolve the thread`, `Update the reply
after a squash`) and `Commits`. Its id and anchor stay `review-replies`; a search
  hit on a template opens the disclosure.
- **Branches** opens on Naming (`WorkspaceBranchNamingBand`: Branch prefix, Branch
  name), then After merge; the branch list is on Storage.
- Each field's page is `FIELD_PAGE` in `features/settings/pageKeys.ts`, so Restore
  defaults, Copy from and the changed count follow a moved field; override keys
  never change.

### Run defaults live on Workflows

Every door to the old Runs page (`general`, `workflow_orchestrator`, a run row)
passes `isRunDefaultsFocus` (`settingRows.ts`), so `SettingsStudio` switches to
Workflows, Every run, and remembers nothing. A searched row rides along in
`everyRunFocusRow`, so Every run scrolls to it, opens Advanced for Parallel agents
and clears it. `general` stays a `PlanPage` (labelled Every run) so the all-pages
Restore defaults and Copy from still carry those fields.

### Projects

- The `Workspace` band's `Name` row renames the workspace; the page writes the
  name once, in the top bar. The page ends in a `Danger zone` with `Clear browser
data` and `Disconnect this workspace`, each confirmed in place.
- A `Terminal folder` row sits above the projects: the computed folder
  (`workspaceFolder`), `Change`, and `Use the default` when overridden
  (`setTerminalWorkspaceFolder`).
- Each folder is listed once under `Projects`; the count is written once in the
  meta line (`3 projects, 1 plain folder`, `projectsCountLine`). A row opens in
  place.
- `Starred` comes before `Other folders` (never both; one `Folders` heading with
  `Star the ones you use most.` while nothing is starred), 16px apart, each a
  `SectionHeader` with its count, Starred with `Agents and pickers list these
first.` Starred never folds; `Show N more` stays under Other folders.
- A project row is 32px on the group grid (star, kind, name, description, a base
  branch chip only when set by hand, a Folder-not-found flag) with Open in editor,
  Copy path and Remove link in a reserved column, dim at rest. The star
  (`StarToggle`, one 24px slot) is filled in the warning tone on starred rows and
  faint at rest on the others.
- Clicking the name opens an inline editor card below the row (description, base
  branch, After merge for repos, folder, scripts, facts, footer actions), starting
  at the name column (`grid-cols-subgrid`). Its `Scripts` field is in
  [session-tools.md](session-tools.md#pins-and-suggestions).
- `starredProjectsFirst({ projects, inside })` is the one order: starred first,
  then by `name` in Settings and `recency` in pickers (`groupProjects`). The
  Sessions folder filter with a starred project and six or more projects shows the
  same headings (`shouldGroupStarred`); a search flattens them. The session Add
  folder list and the New session picker use `projectPickerGroups` instead.
- New session defaults sit in a two-column grid with help behind an info mark,
  then the `After a pull request merges` segmented control. Disconnecting is a
  ghost row at the bottom with a `ConfirmPopover`. Onboarding keeps comfortable
  rows.

### Plain folders and git

- Tracking a plain folder with git is an inline flow in its row
  (`TrackWithGitFlow`, `FolderGitCard`): the first commit review, then `Publish to
GitHub` through the first lap's form (`PublishPanel`). Creating a workspace never
  opens it: the pick row already offers **Track it with git** for a Code folder.
- A documents folder has no git line. A row opens by itself when its git line has a
  notice or the page opens on `track-with-git` or `folder-options`.
- A plain folder's row (`PlainFolderOptions`) holds the Code project or Documents
  switch (`setFolderPurpose`; a failed write keeps the old face with the error),
  one line on what the face means, and its saved versions: the size against the
  cap (`folderHistorySize`) with Review in Storage, or a failed first copy with
  Retry.
- Every window rereads the faces on focus (`useFolderFacesOnFocus`, in the top bar
  watch and on Home).

## Rows, Restore defaults and Copy from

Every row has one shape (`SettingRow`): label, one help line, the control on the
right. A row off its default shows a small Reset on the label line (tooltip `Reset
to default`), after the `N folders use their own` chip of a workspace row
(`WorkspaceFieldRow`).

Restore defaults and Copy from share one inline flow:

1. The page menu (⋯) of every page that owns settings offers `Restore defaults`
   and `Copy from…`; a workspace page's menu adds, after a separator, `Copy all
pages from…` and `Restore all workspace defaults`.
2. The flow opens under the title as a band, never a popover: pick the workspace,
   then a preview grouped by page with a checkbox per page and the from and to
   values, then `Copy N settings`, `Back`, `Cancel`.
3. It ends on a status line with `Undo`.

- The preview is computed when the flow opens (`loadFlowSources`).
- The keys a page owns come from `pageKeys` (`features/settings/pageKeys.ts`),
  typed so a new override key does not compile without an owner.
- Provider defaults belong to Providers and are never copied, nor are projects,
  folders, integration accounts, permission history or `bootstrap.*` keys.
- Restoring writes `null`. One copy or restore is one `patchWorkspaceOverrides`
  through the queued workspace writer.

## Storage

App > Storage is the one place for disk space, scoped by a picker: every worktree
folder Goodboy made, grouped by repository, under To review, In use and Kept.

- Its cards (`Band`): Worktrees (`Scan another repository` at the foot), Branches
  with `Recently deleted`, Artifacts of deleted sessions, Transcripts and app data.
- No summary band: the meta line reads `<total> on this Mac`, or `<total> in
<workspace>` under a scope (shared transcripts and app data left out), from one
  function (`storageTotalBytes`, `storageMetaOf` through `useStorageMeta`), plus
  `Low space: N GB free on this disk` under 10 GB free.
- Sizes are measured one folder at a time after boot, never on the boot path; the
  scan sends nothing.

### Scope

`StorageScopePicker` (a `Listbox`) sits in the header next to `Check again`
(`StorageHeaderActions`), which rereads the scope's sizes and branches
(`StorageCheckAgain`).

- It lists this window's workspace, every other workspace with its weight,
  `Removed workspaces` (folders whose workspace is gone or never linked) and `All
workspaces` with the machine total.
- The scope drives the total, the worktrees and the artifacts together
  (`storageScope`, `resolveStorageScope`), defaulting to this window's workspace,
  or all without one. A scope other than all leaves App data out of the total.
- `openStorage` and the cleanup notifications land on Storage. The workspace
  page's Notice and the `open-orphan-worktrees` action open it scoped to that
  workspace (`openStorage({ scope })`); the `open-storage` nudge opens it scoped to
  all.

### Worktrees

- The header holds the filters and `Remove N safe folders · size`
  (`WorktreeRemoveButton`), the idle-days sentence as its help. The folder `...`
  shows on hover and focus. `Prune` is a secondary that confirms.
- `Suggest cleanup after` is the band's last row (`StorageSuggestAfterRow`); a
  failed save keeps the old number.
- The only bulk action removes clean folders idle past that. A folder with changes,
  an operation in progress, a writer lease or no git registration never joins it
  and says why.
- **One nudge, never a modal.** `evaluateStorageNudge` sends a
  `storage-reclaimable` notification (action `open-storage`) past 10 GB, then stays
  quiet 14 days and speaks again only after another 10 GB. The thresholds and the
  last nudge are settings (`storage.suggestAfterDays`, `storage.lastNudgeAt`,
  `storage.lastNudgeBytes`).

### Branches

`BranchesSection` (`BranchesPage` in `StoragePage`) lists local branches under
Worktrees, in the same scope, hidden under `Removed workspaces`. Its header reads
`N safe to delete · M need a look` (`branchesMetaOf` in `BranchesHeader`).

- **It scans only when it opens**: `git for-each-ref` over the local branches, one
  over `origin` and one for the distance behind the base (`project_branches`).
  Fields split on a unit separator, so a name with `|` still lists; a git without
  the batched distance counts per branch. The merge test is cached by both tips
  (4096 entries) and fed each branch's merged pull request head
  (`listMergedRequestHeads`). Protected branches (the base, `main`, `master`, `develop`) never show; a branch held by a worktree lists, and a delete keeps it until that worktree is removed.
- One select filters: `Safe to delete` (default: merged by merge commit or rebase,
  merged by its pull request with nothing after the merged head, or never used),
  `Check first` (`Merged, then N new commits`, unmerged and gone on origin, local
  only over 30 days, or older than 90 days; never preselected), `All`.
- Every row, Recently deleted included, sits on one grid (`BRANCH_TABLE_GRID`, cells
  marked `data-cell`): select, branch with its session title under it, folder,
  state chip (`Merged`, `No commits` or the verdict, how it merged and where it
  lives in its tooltip), last commit's age, and the action cell (`row-actions`).
- Delete reads the `branch` kind (`branch.delete`). A merged branch goes at once
  with `Undo`; an unmerged one confirms in a popover, and the bulk bar counts the
  commits it takes. `Also delete N on origin` shows only for Goodboy's own pushed
  branches where GitHub does not already delete merged branches.
- Deletes use the after-merge rule's compare-and-delete and 14-day restore. A
  branch another worktree holds reads Protected, so its folder goes first.
- **Recently deleted** is a fold row loaded from `deleted_branches` on open (which
  also releases refs of deletions older than 14 days): the sha under the branch,
  the days left as the chip, Restore and delete for good.

### Artifacts from deleted sessions

Plans, reports and wireframes whose session is gone, under To review and Kept, with
Open, Keep (30 days or always) and Delete (a `ConfirmPopover`). Its one bulk action
deletes the unused ones. Artifacts never nudge on their own.

## Security findings

The `Secrets in saved scripts` band of the workspace's Permissions page, after
Rules (`SecurityFindingsSection` as `afterRules` of `PermissionsSettings`; the old
`security-findings` address lands on Permissions, which carries its dot).

- It scans the text Goodboy keeps for a workspace for known token shapes
  (`scanTextForSecrets`, packages/core). Saved scripts are scanned today; workflow
  steps, the profile, reply templates and permission rules are named in the design
  but not wired yet.
- Each hit is fingerprinted with sha256, never stored as a value
  (`security_findings`, `recordSecurityFindings`).
- A save reconciles that subject: new fingerprints open, missing ones resolve, and
  "Not a secret" (`dismissSecurityFinding`) stays dismissed for the same value
  until "Flag again".
- Without a workspace the page says so instead of scanning.

## Rail tone is state, never decoration

Each row carries its `CONCEPT_ICONS` icon. One reader, `railSubtitles({ state,
workspaceId, nowMs })`, owns every row's sentence and tone; `useSettingsStatus`
calls it once per studio for the rail and the home, and a test mounts the home on
the strict `invoke` mock to keep it free of commands at render.

| Row       | Dot                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Updates   | info while an update is ready (`updatesText`)                                                                                    |
| Storage   | info with "N GB can go" past 10 GB of clean idle folders; warning under 10 GB free with at least 1 GB to go (`storageAttention`) |
| Storage   | warning with "N open" on an undismissed finding (`selectSecurityFindingsAttention`); the worse dot wins (`appAttention`)         |
| Workspace | warning with "N folders not found" when a project reads `missing` in `projectGitStatus`                                          |

- A dot means "needs you", never "connected": provider and tool health lives on
  the Connections tiles and door.
- No rail row is red. Destructive actions close their page in a `Danger zone`
  (Delete all data, Disconnect) and turn red only in their inline confirm.
- Every group is a named `Band` (eyebrow outside) with gap and no `Divider`; a band
  name never repeats its only row, and no group has a bare `Eyebrow`
  (`settings-section-titles-are-bands`). The workspace page is the exception: one
  column of eyebrow sections 24px apart, titled with the workspace name, renamed in
  place.

## Tests

- `settingRows.test.tsx` renders every page and fails when a registry label no
  longer renders, a rendered `data-anchor` key is missing from the registry, or a
  registry row renders without its anchor (`ProfileForm`'s fields and Pair an
  iPhone excepted).
