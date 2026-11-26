# The ⌘K palette

> **Read this when** you change the ⌘K palette: its scope chip, the empty list, ranking, prefixes, a verb row or a mode. **Not for** the search index behind ⌘F ([search.md](../search.md)) or the action registry it reads ([context-menus.md](context-menus.md)).

The palette is one overlay (`features/palette/`), the accepted exception to no
modals: transit, not a flow; Escape or a scrim click closes it. The placeholder and
the top bar pill say **Search or run** (`NAMES.searchOrRun`); **Search** stays ⌘F's
name.

## Modes and size

- `PALETTE_MODES` (`features/palette/paletteModes.ts`) is the mode slot: each mode
  draws its own input row (`PaletteInputRow`) and body, the overlay keeps the query
  and scope, ⇥ moves to the next mode with the same text, and `openPalette({ mode,
query })` opens one. Commands is first, search (⌘F) second.
- 640px wide (search 720px), a 48px input row, 28px rows, a list capped at 320px
  that scrolls, a 320px minimum height (`PALETTE_MIN_HEIGHT_PX`), and a key chip with
  a minimum width so a glyph like Terminal's is never clipped.

## Scope first

It opens on a chip naming the surface you see, first match wins
(`resolvePaletteScope`, reading `resolveSessionSurfaceLayer`):

1. the focused commit row on Commits;
2. the focused Explore row (a file or folder: Open, Show in Finder, Ask, Copy path);
3. the agent, when its page is on screen (not a stored selection under a studio or
   an artifact conversation);
4. the run on the Runs page;
5. the pull request on the Branch page;
6. the session;
7. the workspace, on the board and under any app studio.

A row offers itself with `useHeldPaletteScope`, read only while focus is inside it
(`heldPaletteScope.ts`). Backspace in an empty input removes the chip. An agent, run
or pull request in scope keeps its session's verbs under "For this session", so Copy
worktree path stays one search away; a session verb with a scope verb's label steps
aside.

## The empty list in a session

One fixed list of sections, ranked by state, empty ones hidden:

1. **Next**: up to three rows from `deriveNextSteps`, with the session's next-step
   slot's model, handlers and outcome log (`useSessionPalette` calls
   `useSessionSuggestions` and `useSuggestionActions`), Needs you first. A step the
   slot confirms (Merge, Close branch) confirms here too; mount proposals stay in the
   slot. Push, Create pull request and Rebase (`Open rebase`, landing on the Commits
   base row) live here, since a mount target needs live git status.
2. **For this session** (with **For this agent**, **For this run** or **For this
   pull request** above it for that scope): up to eight verbs ranked by state
   (`paletteTiers.ts`), then **All actions for this session**, the grouped level
   (Open, Act, Copy and export, Danger).
3. **Runs**, when the session has a run or a workflow exists: the run on screen,
   else the one that needs you, is live or is queued, with its state; its verbs in
   state order (Answer, Start run, Continue step, Start next step, Retry step, Stop
   run); **Open Runs**. **Start from** each preset (`startRunFromPresetEntries`) opens
   Start a run with `~` and the preset name.
4. **Recent**, this session's agents first, then four fixed groups by `kind`
   (`EMPTY_SECTION_KINDS` in `commandList.ts`).

The state is the one the column row, the board card and the Now chip show
(`useSessionStageInfo`): archived, needs you, live, ready to ship (an open pull
request, or a push, pull request, ready or merge step), finished, idle. Each state
has a recipe of verb ids: unnamed verbs follow in registry order, a Danger verb is
never in the eight, an archived session shows only restore and copy verbs, and while
an agent runs **Message {agent}** and **Interrupt {agent}** join.

| Group  | Kind     | Rows                                                                                                                                                      |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Go to  | `goto`   | each page destination of `DESTINATIONS` in order (Terminal and Browser open the dock), then the Impact Spend page and Settings; Board answers to Sessions |
| Create | `create` | New session, New chat, New terminal, New workspace                                                                                                        |
| App    | `action` | Resume setup (while unfinished in the main window), Theme: dark, light and system, Check for updates, Connect a provider, New question, the column fold   |
| Help   | `help`   | Guide, What's new, Keyboard shortcuts, Report a bug                                                                                                       |

- New workspace answers to Open a folder and Start a new project (`formerNamesOf` in
  `shared/utils/names.ts`).
- Pair an iPhone (and its former names) and one **Guide: {chapter}** per
  `GUIDE_CHAPTERS` row (through `openGuideChapter`, also with the Guide open) are
  typed only.
- Check for updates opens the Updates band of Settings > Look and alerts and runs the
  check only in a status the menu item checks too; both share `checkForUpdatesNow`
  (`features/updater`).
- The session pages (Open Overview, Questions, Artifacts and the rest) and Impact:
  Spend answer only to typing.
- **On the Board** the first section is **Needs you**: the sessions the Board door
  counts (`useNowSessions`), each opening its `attentionPlace`. The bell, the toast
  and Notifications open through it too: a notification keeps a reason and a mount in
  its stored action (`open-place`, no migration), and a build that does not know the
  kind reads no action.
- The order is the one place the palette differs from a `⋯`: both list the same verbs
  (`menuParity.test.tsx`, counting the verbs inside **Go to**), and `⋯` keeps its
  stable order.

## Typing

- **One ranked list, never regrouped**: a fuzzy subsequence match with bonuses for
  word starts, camel boundaries and runs, so `pay export` finds "Speed up the payout
  export" (`score.ts`); then frecency, uses halved every seven days and capped so it
  only reorders close matches (`frecency.ts`); then a boost for the scope's verbs
  (`rank.ts`). Matched letters are marked; each row shows its shortcut or kind.
- **Every workspace.** Sessions of every workspace are listed
  (`listSessionTitlesAcrossWorkspaces`); one from another names it and opens that
  workspace first.
- **Typing finds everything**: the Next rows, the run verbs, the pull request's verbs
  and the old names (`Stop workflow`, `Run workflow`, `Back to board`, `Open
settings`) wherever the state ranked them.
- **Ask rows.** Text with no prefix starts with `Ask in Chat`, a new chat with the
  query as its first message. With the session or one of its agents in scope, `Ask
about this session` comes first, opening the Ask pane with the query
  (`askEntries`). A query that reads like a question (ends with `?` or has four words
  or more) picks the first Ask row; a shorter one keeps the best match picked.
- **Prefixes**: `@` agents, `#` sessions, `:` workspaces, `$` scripts, `>` actions,
  `?` help.

## Verbs and keys

- **Verbs come from the action registry** (`features/actions/`) with its state rules.
  A verb whose `when` is false never shows; a blocked one shows only when searched by
  name (every word a word prefix of its label), dimmed with its reason, Enter doing
  nothing. Confirmed verbs swap the list for an InlineConfirm; Archive runs at once
  with Undo.
- The registry owns a session's Comments, Changes and Open in terminal, so lens rows
  with those names step aside. Lens rows take their labels from the shortcut
  registry, which reads `NAMES` (`Overview`, `Comments`, `Changes`, `Pull request`);
  `Review`, `Files`, `Diff` and `Session` still answer as former names.
- **Keys.** ↑↓ move; ↵ runs the row (an object row opens it); → opens an object row's
  verbs grouped Open, Act, Copy and export, Danger; ← or Backspace goes back. A verb
  with choices (Change model) opens them as a level. Copy worktree path copies at
  once with one worktree, else lists them (name, branch, path), and ⌘↵ copies every
  path, one per line.
- A preview pane shows only for a row with facts of its own (a session, an agent, an
  artifact, a blocked verb or one that asks first); a plain command takes the full
  width, the hint line saying ↵ Run or ↵ Open.

## Repo rows and New terminal

- The repo rows (`sources/repoEntries.ts`) pull the linked repos' base branch through
  `checkout_update_base`; each row and toast line names the branch it updates and
  where the checkout stays.
- New terminal opens a fresh tab in the Terminal dock, or on the Terminal page while
  it is open; in a session it reads "New terminal in this session" and opens on the
  session's folder.

## Scripts with `$`

In the composer and the palette, `$` lists the scripts of the session's mounted
projects (`useSessionScripts`): saved scripts first, then the pinned `package.json`
and `composer.json` scripts, by category. Manifests are read from each mount the
first time `$` is typed.

- A row's sublabel names its package (the manifest name, or `root`) and shows the
  script's body, not its invocation; the badge is `Running` or the package's short
  name (`web`), so twenty `dev` rows read apart. With several mounts a row names its
  project.
- An empty list says why: no project, no pinned script, or no match.
- Enter runs the row, opens its output in the right drawer and clears the composer.

A palette script runs on `resolveScriptMount`, first match wins: the mount the
caller names; `selectPlaceMount` (the branch page in `diffMountPath`, the selected
agent's or run's mount); the project's only attached mount; else a second step lists
the candidates, the latest run's mount first. The terminal chord and Ctrl+`open on`selectPlaceMount` before the remembered scope. The Scripts pane lists the same set
([session-tools.md](session-tools.md#the-scripts-pane)).

## Search (⌘F)

The second mode: a local index over sessions, messages, agents, artifacts,
decisions, questions, issues, pull requests and branches, with filters and a
preview. A hit lands in context through the one door, and ⌘G and ⇧⌘G walk the
matches in that view. A focused terminal keeps ⌘F for its scrollback.
[search.md](../search.md) owns the index, the landing targets and the find rules.
