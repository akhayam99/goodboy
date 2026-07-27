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

`AppBreadcrumb` is NOT rendered in `AppTopBar`. The top bar holds only the
logo (left) and global controls (right). Navigation context is surfaced
differently depending on where the user is:

- Inside a session: `WorkspacesSidebar` shows a "Back to board" action
  directly under the workspace header, above the sessions list.
- Inside a session lens: `buildSessionBreadcrumb`
  (`features/session/components/SessionWorkspace/sessionBreadcrumb.ts`) renders
  an in-content trail, at most three crumbs deep, always rooted at a clickable
  `Overview`. Shapes: `Overview > {LensName}`,
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

The workflow case swaps the label instead of dropping the crumb: when the home
lens is Workflows, `ChatWorkflowHeader` renders the same `AgentBreadcrumb`, with
the workflow's kind name as the home label (falling back to "Workflows"),
followed by the `WorkflowStepper` strip alongside it in the same header row.
There is no separate "Part of {WorkflowName}" line.

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

`AppTopBar` is the single app-chrome row. Layout: logo on the left; all
global controls on the right. No breadcrumb renders in the top bar.

Global controls (right side): cost rollup, theme toggle, notifications, guide,
pair-device, settings.

Controls dispatch the same `goodboy:*` events and callbacks as before.

`WorkspacesSidebar` contains only the sessions/agents content. No global
controls live in the sidebar.

## App footer

`AppFooter` is a persistent bottom bar rendered via the `AppShell` `footer`
slot. Always visible on the board and inside a session.

Layout:

- Left: integration tools (GitHub, GitLab, Linear, Sentry), each gated by
  enablement.
- Right: common studios (workflows, providers, budget, impact), each with its
  own tone (`primary`, `info`, `warning`, `success` respectively) applied to
  its icon and label while inactive.

Studio buttons show an inverted active state (`bg-foreground text-background`
with a transition) when their studio is open. Opening any studio closes the
others (`closeAllStudios` in `App.tsx`).

## Board-only Overview and animated sidebar

`AppShell` has an additive `leftHidden` prop. When `true`, the left column
animates to zero width via `grid-template-columns` transition; the cell fades
and slides (`opacity` + `transform`). The resize handle is suppressed while
hidden.

`App.tsx` sets `leftHidden={!currentSession}`:

- Overview (no session active): board-only, sidebar hidden.
- Session entered: sidebar reveals with a ~200ms animation.

The sidebar has no collapse toggle, rail, or `cmd+b` shortcut. The left column
is either `leftHidden` (at Overview) or at its persisted width.

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

### Sibling panels inside a lens

Four surfaces open their detail to the right of the content instead of taking a
studio rail: `ResolverInspector` (from a resolver row's "Details" action in the
Resolve lens), `AgentInspector` (from an agent row's "Details" action in the
Agents lens), `SlotHistoryPanel` in `SlotPane` (the history trigger in the pane
header of the Goal, Decisions, and Session summary lenses, rendered only when
that slot has history), and `PlanListPanel` in `PlanStudio` (the "Other plans
(N)" trigger in the pane header, rendered only when the session holds more than
one plan).

`ResolverInspector`, `AgentInspector`, and `SlotHistoryPanel` share one
primitive, `InspectorSplit` (`SessionWorkspace/parts/InspectorSplit/`): the pane
is a flex row, the panel is a sibling column resizable via a `ResizeHandle`
(width persisted at `STORAGE_KEYS.inspectorPanelWidth`), open state is local to
the pane, the panel loads or refreshes its data when it opens, and it closes
from its own header. `PlanListPanel` predates this primitive and stays a
fixed-width column behind a plain `<Divider>`. Reuse `InspectorSplit` for the
next detail surface rather than adding a rail.

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

The footer carries a "Set up workflow next" checkbox
(`SetupWorkflowToggle`). It defaults to on, persists in `localStorage` under
`goodboy:session-setup-workflow` (not in the DB), and is passed to
`createSession` as `openWorkflowBuilder`, which opens the new session with the
workflow studio focused instead of the chat.

## Sessions list: archived toggle

The archived sessions toggle sits in the sessions header row, next to the
sessions filter. It is not a separate bottom row.

## Questions lens: answered history

Below the open-questions empty state, the questions lens shows an
answered-questions history. Entries are grouped into clusters by the agent that
spawned them. Each cluster header is space-between: agent name on the left,
asked-at timestamp on the right. Clusters are ordered most-recent-first.
Clicking an agent name navigates to that agent.

## Resolve lens: two force actions

The State section of `ResolverInspector` holds both, and they do different
things:

| Action                     | Effect                                                                                                                                                                  | Shown when                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ForceCloseResolverAction` | Cancels the running turn, stamps the agent `skipped`, marks it stopped, then activates the next queued resolver. Does not touch the code host.                          | The resolver or its agent is running                                                               |
| `ForceResolveAction`       | Resolves the thread on the code host (optional note) and refreshes the PR detail. Never cancels a turn or stops a process, and the resolver keeps whatever state it had | The resolver has a source thread, no turn is running, and it is awaiting, failed, done, or stopped |

Both also appear on the resolver's card footer in the Resolve lens
(`ResolverCardFooter`), so they are reachable without opening the inspector.
Both arm on first click and act on the second, so neither fires by accident.

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
