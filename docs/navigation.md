# Navigation and information architecture

Covers the breadcrumb model, app-chrome header, sidebar visibility, and studio
taxonomy. For the file locations of every component named here see
[file-system.md](file-system.md). For visual layout rules see
[styling.md](styling.md).

## Breadcrumb derivation

`buildBreadcrumb(input)` is a pure function in
`apps/desktop/src/app/components/AppBreadcrumb/buildBreadcrumb.ts`.
It is rendered by `AppBreadcrumb` (same folder) inside `WorkspaceLinkDialog`
(the workspace-create dialog). No router, no nav store: the crumb is derived
from the existing store (`currentWorkspaceId`, `currentSessionId`,
`workspaces`, `sessions`) plus the studio open-state flags forwarded from
`App.tsx`.

`AppBreadcrumb` is NOT rendered in `AppTopBar`. Navigation context is surfaced
differently depending on where the user is:

- Inside a session: `WorkspacesSidebar` shows a "Back to board" action above
  the sessions list, bound to ⌘⇧H and showing that glyph on hover.
- Inside a session lens: `buildSessionBreadcrumb`
  (`features/session/components/SessionWorkspace/sessionBreadcrumb.ts`) is read
  by `useSessionCrumbs` and rendered by `SessionStripCrumbs` in the top bar,
  rooted at the session goal rather than at a separate `Overview` crumb. The
  trail below is what `buildSessionBreadcrumb` returns; the strip drops its
  first crumb and uses the session title in its place. At most three crumbs
  deep. Shapes: `Overview > {LensName}`,
  `Overview > Workflows > {WorkflowName}`, `Overview > Plans > {PlanTitle}`,
  and for the session studios `Overview > Workflows > Create`,
  `Overview > Pull request > PR #{n}`, `Overview > Pull request > Merge request`.
  The last crumb is the current location and is never clickable. With an agent
  open this trail is replaced entirely by the agent-overlay breadcrumb (see
  below), never nested inside it.

### In-session crumb precedence

With an agent open, `AgentOverlay` replaces the lens content (transcript plus
inspector, no separate agent-list column) and its own header renders
`AgentBreadcrumb` (`SessionWorkspace/parts/AgentBreadcrumb.tsx`, crumbs built by
`agentOverlayCrumbs.ts`) instead of the `Overview > ...` trail above. Shape:
`{HomeLensName} > {AgentName}`, e.g. `Agents > {AgentName}`; never rooted at
`Overview`, at most two crumbs. The overlay used to carry a dedicated
agent-list column with its own back button (`ChatHeaderBack.tsx`) and a
persisted width (`STORAGE_KEYS.agentOverlayListWidth`); both are gone, and
`AgentBreadcrumb` is the sole navigation control in the header now.

The first crumb is that agent's home lens, resolved by `resolveOverlayHome`
(same folder). If the active lens is one that hosts an agent list (`agents`,
`resolve`, `workflows`), the active lens wins; otherwise the selected agent's
own home lens is used, falling back to `agents`. Standing in Agents with a
workflow-step agent selected therefore keeps the crumb on Agents: before this
rule, an auto-advancing workflow step renamed the crumb while the user was
standing in another lens.

The last crumb is plain text when the agent has no sibling agent sharing the
same home lens; otherwise it is a button that opens a popover listing those
siblings (avatar, name, status) to switch the open agent in place, via
`selectAgent`.

The workflow case swaps the whole control instead of dropping the crumb: when
the home lens is Workflows, `ChatWorkflowHeader` renders `WorkflowBreadcrumb`
(same folder) in place of `AgentBreadcrumb`. The trail starts with
`{HomeLabel} > {StepName}`, where the home label is the workflow's kind name
(falling back to "Workflows") and the step crumb is a popover switching step via
`selectAgent` on that step's root agent. When the step root has implementer
cluster children, a third crumb appears. It shows `{AgentName}` when a child is
selected and `{CompletedCount}/{ClusterCount} clusters` when the root is
selected. Completed and skipped children both count as done. There is no
separate step strip and no "Part of {WorkflowName}" line.

### Crumb trails

The table below shows the conceptual IA that `buildBreadcrumb` implements.
It is currently rendered only inside `WorkspaceLinkDialog` for the
`Overview > Workspace > Create` trail; the other rows describe the logical
model the function supports.

| Trail                                               | When shown                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Overview                                            | No workspace is active (empty state only)                                                                     |
| Overview > Workspace > {WorkspaceName}              | Active workspace board (normal board state)                                                                   |
| Overview > Workspace > {WorkspaceName} > {StepName} | Open session work surface; {StepName} is the session label (session.goal, falling back to "untitled session") |
| Overview > Workspace                                | Workspace launcher / switcher                                                                                 |
| Overview > Workspace > Create                       | Workspace creation dialog                                                                                     |
| Overview > Resolve [> {ResolveName}]                | Resolve surface                                                                                               |
| Overview > PullRequest > Comments                   | GitHub Studio PR comments                                                                                     |

"Step" is the requester term for a session; the rendered crumb uses the real
session label, not the word "step".

The bare `Overview` row appears only when no workspace is active. The normal
board renders `Overview > Workspace > {WorkspaceName}`.

The last crumb is always the current location and is non-clickable. Clickable
crumbs navigate via `toOverview` / `toWorkspaceLauncher` / `toWorkspaceBoard`.

### Chrome states

`BreadcrumbChrome` is the visual wrapper applied to the breadcrumb row. States:

| State                | Trigger                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`               | Default                                                                                                                                                         |
| `workspace-launcher` | `switcherOpen`                                                                                                                                                  |
| `workspace-create`   | `addWorkspaceOpen`                                                                                                                                              |
| `pull-request`       | `githubStudioOpen`                                                                                                                                              |
| `resolve`            | Supported by the builder; not yet wired to a global flag. The live resolve surface is the session's Resolve lens (`ResolverAgentsLane`), not a sidebar cluster. |

## App-chrome header

`AppTopBar` is the single app-chrome row, 36px tall. Left to right: the mascot,
the sessions-column toggle (only inside a session), the workspace identity and
its switcher popover, then the session breadcrumb, which does render here and is
rooted at the session title.

Right side: update pip, workspace rollup (attention count and today's spend), a
divider, then running scripts, notifications, onboarding and settings. Theme,
the guide and pair-device left this row: they are set-once preferences and live
in the settings studio and the command palette.

Controls dispatch the same `goodboy:*` events and callbacks as before.

`WorkspacesSidebar` contains only the sessions/agents content. No global
controls live in the sidebar.

## App footer

`AppFooter` is a persistent bottom bar rendered via the `AppShell` `footer`
slot. Always visible on the board and inside a session.

Layout:

- Left: integration tools (GitHub, GitLab, Linear, Sentry), each gated by
  enablement.
- Right: common studios (workflows, providers, budget, impact).

Navigation chrome stays muted while inactive across footer launchers, session
lens rows, and the back-to-board action in the workspace sidebar.

The active navigation item uses one inverted state
(`bg-foreground text-background`) across those surfaces. Lens rows keep
`aria-current="page"` on the active row. Opening any studio closes the others
(`closeAllStudios` in `App.tsx`).

Every lens row is bound on the ⌘⌥ plane and reveals its glyph on hover, in
place of the row badge, so the rail teaches the binding without widening.
`LENS_SHORTCUTS` in `LensColumn/groups.ts` maps each `LensKind` to a registry
id and never to a literal combo.

## Board-only Overview and animated sidebar

`AppShell` has an additive `leftHidden` prop. When `true`, the left column
animates to zero width via `grid-template-columns` transition; the cell fades
and slides (`opacity` + `transform`). The resize handle is suppressed while
hidden.

`App.tsx` keeps Overview board-only and applies the user preference in session:

- Overview (no session active): board-only, sidebar hidden.
- Session entered: sidebar follows the persisted sessions-column preference.

The sidebar has no collapse rail. In a session, users hide or show the sessions
column from the single control in the top bar or with ⌘B, whose glyph the
control itself spells out in its tooltip and label. The toggle writes
a persisted preference, while Overview still forces `leftHidden`. Collapsed, the
column still comes back on hover as a temporary overlay
(`features/workspace/components/SidebarPeekOverlay`); the peek never touches the
persisted preference.

## Studios

### Utility studios

Settings, budget, providers, impact, Linear, Sentry, GitLab, workflow, guide
are modal overlays, all built on `StudioShell`'s fullscreen variant. They are
not part of the breadcrumb IA and are exited via their close button or Esc.

### Workspace creation

`WorkspaceLinkDialog` renders the `Overview > Workspace > Create` breadcrumb
(via `AppBreadcrumb`) inside its header. After creation it lands on the new
workspace board. The first-run onboarding wizard continues if `isWizardDone`
is false.

### Master-detail studios

GitHubStudio, LinearStudio, and similar surfaces use a narrow list rail
alongside a detail panel. This is an intentional master-detail pattern, not
the dual-sidebar anti-pattern. The rule "no surface shows a left panel and a
right panel at once" refers to two sidebars flanking content, which the app
does not do.

### The workflows lens has three levels

The lens reads like the Agents lens, one level at a time, never a rail plus a
detail at once. `WorkflowsPane` lists the attached runs; the completed and
discarded toggles live in its header and hide their sections by default, so a
session whose runs are all done shows an empty state instead of silently opening
the last completed run. Selecting a card writes `focusedWorkflowRunId` and swaps
the list for `WorkflowRunDetail`, which hosts the run through `AgentsSection`
(`workflowVariant="detail"`). Selecting a step in the strip opens
`WorkflowStepInspector` in an `InspectorSplit` beside the run, and the step chat
is one explicit click from there, never an automatic redirect. The trail back is
the breadcrumb `Overview > Workflows > {WorkflowName}`.

### Sibling panels inside a lens

Five surfaces open their detail to the right of the content instead of taking a
studio rail: `AgentInspector` (from an agent row's "Details" action in the Agents
lens and from a resolver row's "Details" action in the Resolve lens, since it is
one component for both: it adds `ResolverSections` when the agent classifies as a
resolver), `SlotHistoryPanel` in `SlotPane` (the history trigger in the pane
header of the Goal, Decisions, and Session summary lenses, rendered only when
that slot has history), `ScriptDetail`/`ScriptEditor` in `ScriptsPanel` (clicking
a script row opens `ScriptDetail`, whose Edit button swaps the same panel to
`ScriptEditor`; that is the only route to the editor), and `PlanListPanel` in
`PlanStudio` (the "Other plans (N)" trigger in the pane header, rendered only
when the session holds more than one plan).

`WorkflowStepInspector` in `WorkflowRunDetail` is the fifth.

`AgentInspector`, `SlotHistoryPanel`, and `ScriptDetail`/`ScriptEditor` share one
primitive, `InspectorSplit`
(`SessionWorkspace/parts/InspectorSplit/`): the pane is a flex row, the panel is
a sibling column resizable via a `ResizeHandle` (width persisted at
`STORAGE_KEYS.inspectorPanelWidth`), open state is local to the pane, the panel
loads or refreshes its data when it opens, and it closes from its own header.
`PlanListPanel` predates this primitive and stays a fixed-width column behind a
plain `<Divider>`. Reuse `InspectorSplit` for the next detail surface rather
than adding a rail.

`ScriptsPanel` is the one consumer that nests the split _inside_ its
`PaneShell` rather than wrapping it, because the same component also mounts in
Workspace settings where there is no `PaneShell`. Its lens therefore inherits
`PaneShell`'s `max-w-5xl` reading column so the list and the editor each keep a
usable width.

## New session form

The new-session creation form (`features/session/components/NewSessionView`)
renders centered on the plain background with no card chrome and no close (X)
button. Cancel dismisses it. If an attachment image preview is open, ESC closes
only the preview, not the form.

Sections, top to bottom: issue source (conditional), goal, attachments, branch.
The issue-source section is derived from the workspace's connected integrations
via `resolveIssueSources` (Linear, GitHub, GitLab, Sentry) and the whole section
is hidden when none of them is connected. Picking an issue fills the goal from
the issue and the branch slug from its identifier, and counts as a manual slug
edit, so later goal typing no longer re-slugs it.

Creating a session always lands on Overview; there is no workflow-setup toggle
in the footer. The operator decides whether to start a workflow from there.

## Sessions list: archived toggle

The archived sessions toggle sits in the sessions header row, next to the
sessions filter. It is not a separate bottom row.

## Questions lens: answered history

Below the open-questions empty state, the questions lens shows an
answered-questions history. Entries are grouped into clusters by the agent that
spawned them. Each cluster header is space-between: agent name on the left,
asked-at timestamp on the right. Clusters are ordered most-recent-first.
Clicking an agent name navigates to that agent.

## Resolve lens: one source for the resolver actions

`resolverActions` (`features/session/resolverActions.ts`) is a pure function that
turns a resolver plus its state into the ordered list of actions, each with a
label, a role and its confirm copy. `ResolverActions`
(`features/session/components/ResolverActions`) renders that list and owns the
store calls, in two densities: `compact` on the resolver card in the Resolve
lens, `full` in the resolver Actions section of `AgentInspector`. Card and
inspector cannot diverge, because neither decides what to offer.

| Action              | Effect                                                                                                                                        | Offered when                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `push`              | Pushes the branch, posts the resolution and resolves the thread. Labelled `Push now` when the thread is already queued for a batch push       | The resolver committed and a commit sha is known                                                   |
| `queue` / `dequeue` | Adds the thread to the batch push, or takes it out again                                                                                      | The resolver committed and the session has a pull request                                          |
| `proceed`           | Sends the proceed prompt so the resolver implements the fix it only analyzed                                                                  | The resolver analyzed the comment without committing                                               |
| `explain`           | Publishes the explanation and closes the thread without a fix. The explanation is mandatory                                                   | The resolver analyzed the comment or declared it wontfix                                           |
| `continue`          | Selects the resolver and focuses the composer                                                                                                 | The resolver is awaiting input                                                                     |
| `run`               | Activates the next queued resolver                                                                                                            | The resolver is queued                                                                             |
| `forceClose`        | Cancels the running turn, stamps the agent `skipped`, marks it stopped, then activates the next queued resolver. Does not touch the code host | The resolver or its agent is running                                                               |
| `forceResolve`      | Resolves the thread on the code host (optional note) and refreshes the PR detail. Never cancels a turn, and the resolver keeps its state      | The resolver has a source thread, no turn is running, and it is awaiting, failed, done, or stopped |

Every destructive action arms an `InlineConfirm` on first click and acts on the
second, so none of them fires by accident.

## From a review comment to its commit

`resolverCommitSha` (`features/session/resolverCommitSha.ts`) is the one answer to
"which commit belongs to this thread": the sha queued for the batch push wins,
then the sha attributed on the branch, then the sha the resolver reported in its
outcome. `ResolverActions` uses it to decide whether a push is possible, and
`ResolverSections` uses it to make the resolver Changes section navigable.

In that section every reported commit opens the session diff lens at that commit,
and every file the resolver edited opens the same lens scrolled to that file. Both
call `setDiffFocus(sessionId, { sha, path })` and then `setActiveLens(sessionId,
'files')`, the same pair the workflows lens uses with `setFocusedWorkflowRun`.
`FilesPane` reads `diffFocus` off the store and hands it to the diff pane, which
switches its `DiffView` to `{ kind: 'commit', sha }` and scrolls to the file.
`setActiveLens` drops the focus on any lens other than `files`, so it never
survives into an unrelated surface. File rows stay inert while no commit is known,
since there would be nothing to filter, and file paths render relative to the
session worktree with the absolute path kept as the `title`.

A sha reported but absent from the branch is still clickable: the lens loads
`git show` for it and surfaces the git error when the worktree does not carry it.
That is the honest answer, since nothing else in the app can resolve a commit the
branch never received.

## One answer per review thread

A resolver writes the answer a reviewer will read in a keyed block,
`<<comment-reply id="PRRT_...">>body<</comment-reply>>`. Both the single-comment
and the combined prompt inject the real thread ids and ask for one block per
thread. `extractAllCommentReplies` (`packages/core/src/context/marker-parsing.ts`)
returns one `(threadId, body)` pair per thread, keeps the last block when an id
repeats, and drops blocks with an unknown id or an empty body. Since replies are
keyed by thread id, one answer can never be cross-posted on several threads.

`completeResolvedAgent` attaches each body to the outcome of the thread it names,
so a reply for a thread with no resolution, wontfix, or analysis marker is
discarded. On publish, `markThreadResolvedNoPush` reads it through
`resolverReplyForThread` and `buildResolutionReplyBody` puts it above the commit
link or the closing reason. Without a block the body degrades to the machine
line alone, which is what every resolver produced before the marker existed.

## Rewriting local history before the push

The resolver inspector has a "What you can still rewrite" section listing the
commits attributed to that resolver, newest first. A commit already on the remote
is listed but inert, labelled "already pushed", since rewriting it would need a
force push. The newest local commit can be reworded, any older local one can be
squashed together with everything above it into a single commit.

Both actions go through the store (`amendSessionCommit`, `squashSessionCommits` in
the worktrees slice) to `worktree_amend_commit` and `worktree_squash_commits`.
Eligibility is decided in Rust, never in the UI: the commit must be inside
`@{u}..HEAD`, or inside the whole history when the branch has no upstream. A
commit outside that set fails with an explicit error, and no code path in this
feature ever passes `--force` or `--force-with-lease`. Amend refuses anything but
HEAD, squash refuses the first commit of the repository, and both refuse to run
while something is staged. The squash is a `reset --soft` to the parent followed
by one commit, so a rejected commit (a pre-commit hook, for instance) restores
the original HEAD and never leaves a rebase in progress.

Each command returns the new head plus the shas it replaced, and
`repointRewrittenCommits` moves every `resolverThreadOutcomes` entry and every
queued row in `sessionPendingResolutions` from a replaced sha onto the new one.
Without that step a later publish would post a link to a commit that no longer
exists.

## Workflow advance from the chat

`ChatWorkflowAdvance` (`SessionWorkspace/parts/ChatWorkflowAdvance.tsx`) renders
under the stepper strip in the chat header of a workflow-step agent and hosts
`WorkflowNextStepCta`. `resolveWorkflowAdvance` (`features/workflows/advanceGate.ts`)
decides its state: complete (nothing renders), ready, or blocked with a reason.
The four block reasons are open questions on the run, a running summarizer, a
failed step in the chain, and a step turn still running.

Blocked never hides the action, it re-routes it: the CTA states the reason and
the click opens an inline confirm ("start anyway", or "skip and continue" for a
failed step) before anything spawns. A step starts on its own only when the run
has auto-run enabled; with auto-run off nothing advances without a click.

## Agent-kind picker

The `AGENT_KIND` role picker is `CreateAgentPopover`'s agent-kind grid
(`AgentKindGrid`), embedded in `StandaloneAgentsLane` and shared by
`AgentsSection` (sidebar) and the Agents lens pane, so it lives wherever agents
are listed. The grid hides kinds flagged `visible: false` (today `resolver`,
which only the resolve UI spawns). New-session creation does not include an
agent-kind picker: agents are spawned after the session exists. It does carry
the "Set up workflow next" toggle described above, but no workflow or step is
chosen in the form; the workflow is built after creation.

## Session activity bar

The session activity bar (sessions list in `WorkspacesSidebar`) shows ALL
sessions grouped by stage: building, running, needs-you/attention, in-review,
done. It is not filtered to running sessions only. The board also surfaces
every stage.

## Full-page studios

Studios using `StudioShell` (fullscreen variant) render between the top bar
and the footer (`top-9 bottom-9`). Both bars stay visible and interactive
while any studio is open. Only one studio is open at a time.
