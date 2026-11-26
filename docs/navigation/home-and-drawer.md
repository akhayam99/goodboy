# Home, creation and the right drawer

> **Read this when** you change Home, the way a workspace, a project or a session is created, or the New session draft. **Not for** the right drawer ([right-drawer.md](right-drawer.md)), the dock grid ([dock-grid.md](dock-grid.md)) or what each drawer kind shows ([drawer-kinds.md](drawer-kinds.md)).

## Home

Home is a window's one page with no workspace open, whether workspaces exist or not.
`App.tsx` renders it whenever `currentWorkspace` is null, in every window. It has no
app chrome, so it carries the lockup itself: the 40px `BrandTile`, the word and the
version ([brand.md](../brand.md)). Under it:

- **Workspaces**, most recent first (`WorkspaceRow`): the tile, the name, the folder
  count (`folderCountLabel`, "3 folders"), the folders' common parent
  (`workspaceFolderPath`, home as `~`), Open in a new window, Disconnect behind an
  inline confirm, and when it was last opened. A one-plain-folder workspace says its
  face instead ("Documents", "Code, no git yet": `workspaceFaceLabel`, falling back
  to `folderCountLabel`). A click opens it here, or in a new window while agents run
  here. Search shows from five workspaces on.
- **New workspace** (⌘N on Home, `home.newWorkspace`) fires `goodboy:add-workspace`
  through `openNewWorkspace`, like the switcher, Search or run and the menu bar. On
  Home the `addWorkspace` place swaps the list for `NewWorkspaceForm` in place, the
  lockup staying put; Cancel or Escape goes back, and Create opens and lands in the
  new workspace whatever its folders.
- **No workspace yet**: a card on how a workspace starts, with New workspace and,
  while setup is unfinished in the main window, "Setup paused at Workspace · 1 of 3
  done" and **Resume setup** (`useSetupResume`, counted by `setupProgress`).
- **Reopen the last workspace on launch**, a switch.

Setup mounts over Home, in the main window only
([setup-and-crash.md](setup-and-crash.md#first-run-setup)). The app layers keep one
key across Home and the shell, so the wizard is not remounted when the first
workspace opens under it.

## Starting a project from nothing

Every door that creates or adds folders opens one inline form, `NewWorkspaceForm`
(`shared/components/NewWorkspaceForm/`), never a dialog, owning its action row:

| Mode        | Where                                         | Notes                                |
| ----------- | --------------------------------------------- | ------------------------------------ |
| `first-run` | the setup Workspace step                      | title "Your first workspace"         |
| `new`       | the New workspace studio and Home             | never reopens setup                  |
| `add`       | the empty board, Settings, Workspace, folders | adds to the workspace it names by id |

1. **Pick or drop a folder.** Choose folder (Cmd+O) or a drop only reads:
   `validate_git_repo`, `scan_child_repos` and the move preview fill a draft in
   memory (`useWorkspaceDraft`).
2. **Name.** The workspace takes the folder's name (`nameFromFolder`), edited in
   place; Escape while editing restores it.
3. **Create** calls `createWorkspaceWithFolders` once, with an id the draft made
   before the write; Retry reuses it. Nothing is written before Create.

What a pick shows: a repository its Git and default branch; a subfolder of one snaps
to its root and says so; a folder of repositories lists them checked; a plain folder
offers git init on Create (a plain Code folder is offered git on its pick row); an
unreadable folder says why (macOS privacy opens Privacy settings through
`open_privacy_settings`) and keeps Create off. **A folder another workspace holds**
asks Move it here or Leave it out: Create stays off until one is chosen, Move is off
while agents run there, and the move happens on Create.

Each read carries a pick number, taken before the folder dialog opens (`isPicking`
keeps Choose folder busy), so an answer for an older pick, or one arriving after
Start from scratch, Back or closing the form, is dropped.

**Start from scratch** asks a folder name and a location (the last parent folder,
else home, changed with the system picker). Create makes the folder, a repository on
`main` with a first commit holding only `.gitignore`, and the workspace named after
it; outside setup it opens the first lap session, in setup the next step.

**The first lap** session shows one notice under its goal, `Not published yet`, with
**Publish** ([lens-surfaces.md](lens-surfaces.md#the-overview)). Publish opens an
inline panel: a repository on your own GitHub account (visibility always an explicit
pick) or any HTTPS or SSH address; with changed files the primary reads **Publish
and move my work**. When `main` appears on the remote, whoever pushed it, the banner
becomes the move card; a move in progress has its banner, and a finished one leaves
a report on the bootstrap session until dismissed. The git pill offers **Publish** on
a repository with no remote.

## Creating a session

The new session form always lands on Overview.

- No agent-kind picker before the session exists: the kind is chosen inside it.
- Its issue sources come from a curated allowlist, since a connected code host is
  not an issue picker; the section hides when none is connected.
- It picks no project: the session is born on the workspace with only a container
  directory, and projects materialize when work reaches them
  ([concepts.md](../concepts.md) → Lazy sessions).
- Every start from a task says **Start from** and the identifier (`startFromLabel`):
  **Start from HBL-412** in Tasks and the draft, **Start from #318** in the one-step
  panel, **Start work from chat** in Chat. **Review pull request** is the exception,
  the review being the work. Retired phrases are in `retiredNames.ts`.

### New session is a draft, not a session

New, ⌘N, the board, the palette and the checklist open the `New session` draft (the
`session-draft` place, address `new`); on Chat, Terminal and inside Ask the same
chord is new chat, new terminal and New question ([keyboard.md](../keyboard.md)).

- **Nothing is written**: no row in the database, the column or the board. The title
  says `New session`, faint and not renamable, with no crumbs, `⋯` or chip. The
  column's New session row stays selected.
- One draft per workspace in memory (`store/slices/sessionDraft/`), never on disk:
  leaving keeps it, New brings it back, and the button shows a primary dot with
  `Draft in progress` while a written draft waits.
- The task field counts as written: with no session the draft holds it as
  `workflowGoal` (`StartTaskField` writes it; `useStartShape` and `useStartRun` read
  it; `pickIssue` fills it). The picked kind lives in the draft too (`startKind`,
  `startShape`), written by a door that opens on a kind (`openNewSessionAs`); a kind
  alone is not content.
- **Leaving.** The header has no `Esc` label and no X. Esc closes the page
  (`closeSessionDraft`) and lands on the place before it, or the board, also `up()`'s
  parent (`placeBeforeDraft`). With nothing written Esc leaves at once; with text it
  raises `Keep this draft?` under the form, inline (`SessionKickoff` `notice`), whose
  one action `Keep draft` (or a second Esc) leaves and keeps it. `Discard`, beside
  Start, shows only with text and runs `discardSessionDraft`, clearing the draft and
  both builder drafts of the workspace, then closing. Back returns to the draft like
  any place.
- **What it asks.** No question first (`SessionKickoff`): **Projects** (`WhereChip`)
  is optional in the task field, **Start blank** in the header. Where is a searchable
  multiple `Listbox` in three groups (`projectPickerOptions`, `projectPickerGroups`):
  "Starred" by name, "Recent" with at most five (the issue's matched folder first
  with its reason, then the active folders of the latest sessions,
  `recentProjectIdsOf`), "All projects" by name. `Project.lastAccessedAt` moves only
  when a folder is added or reconnected, so it never orders the picker. Each row has
  a `ListboxStar` (the star or ⌘S calls `setProjectStarred`, the row changing after
  the save, a failure in the list status, `useProjectStarToggle`); with nothing
  starred the list ends on one hint (`ProjectStarHint`). The picks are `projectIds`:
  the first is the session's project, the rest are added (`additionalProjectIds`).
- **From Tasks**: **Start** on an issue calls `pickIssue`, putting it in
  `pickedIssues` and filling the field with its goal (`issueGoalOf`, the title when
  the goal is empty; the `goodboy:start-run:new` event). Setup's handoff
  (`handOffFirstSession`) seeds the field the same way. Picked issues show as
  removable rows above the field (`PickedIssueRow`).

### Start is the only way a session is born

`startSessionFromDraft` creates the session and starts the work in one gesture:

1. The title and goal come from the issue, the workflow goal or the Scout focus's
   first sentence; a picked issue is linked.
2. With picked issues the kind is `task` with a `then` of kind `workflow-run`, and
   `startRoutedRun` starts the run the router picked (a linked task reads as row 3, a
   plan, unless the ask names a role or a preset); otherwise `workflow-run`.
3. The column moves to the new session. Its title reads `Named by Goodboy` until you
   rename it or reopen the session, and a better title fades in later without moving
   the layout.

A failed start removes the session again, keeps the draft, the issues and the text,
shows the reason above the primary, and Start becomes **Retry**. A session that
exists always has a real title; one created elsewhere with no activity shows the
plain overview with its actions.

**Start blank** (`startBlankSession`) creates a session with no title and no goal
slot on its normal Overview (`Untitled session`, `Add a goal`, the start form
inline); nothing is required, and the draft stays for the next New.

## The right drawer

Every drawer is one primitive, `DrawerColumn` from `@goodboy/ui`, never a split
inside a pane. Containers, tiers, the push rule, the slot store, focus and Esc are in
[right-drawer.md](right-drawer.md); each kind's content in
[drawer-kinds.md](drawer-kinds.md).

### The grid saved on the session

Each session remembers its dock grid (panels, columns, widths, the split of two
stacked panels, the focus, the face) in `session_dock_grids`, one row per session;
the rules and the failure table are in
[dock-grid.md](dock-grid.md#the-grid-saved-on-the-session).
