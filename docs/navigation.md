# Navigation and information architecture

Covers the breadcrumb model, app-chrome header, sidebar visibility, and studio
taxonomy. For the file locations of every component named here see
[file-system.md](file-system.md). For visual layout rules see
[styling.md](styling.md).

## Breadcrumb derivation

`buildBreadcrumb(input)` is a pure function in
`apps/desktop/src/app/components/AppBreadcrumb/buildBreadcrumb.ts`.
It is rendered by `AppBreadcrumb` (same folder) inside `AppTopBar`. No router, no
nav store: the crumb is derived from the existing store
(`currentWorkspaceId`, `currentSessionId`, `workspaces`, `sessions`) plus the
studio open-state flags forwarded from `App.tsx`.

### Crumb trails

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

| State                | Trigger                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `none`               | Default                                                                                                                       |
| `workspace-launcher` | `switcherOpen`                                                                                                                |
| `workspace-create`   | `addWorkspaceOpen`                                                                                                            |
| `pull-request`       | `githubStudioOpen`                                                                                                            |
| `resolve`            | Supported by the builder; not yet wired to a global flag. `ResolveCluster` lives in the sidebar for now; this is future work. |

## App-chrome header

`AppTopBar` is the single app-chrome row. Layout: logo and breadcrumb on the
left; all global controls on the right.

Global controls (right side): palette, skills, workflows, providers,
GitHub/GitLab/Linear/Sentry integrations, budget, notifications, guide,
onboarding, pair-device, theme, settings.

Controls dispatch the same `goodboy:*` events and callbacks as before. Feature
gating (skills, Linear/Sentry/GitLab enablement, providers pulse) is
preserved.

`WorkspacesSidebar` contains only its collapse toggle and the sessions/agents
content. No global controls live in the sidebar.

## Board-only Overview and animated sidebar

`AppShell` has an additive `leftHidden` prop. When `true`, the left column
animates to zero width via `grid-template-columns` transition; the cell fades
and slides (`opacity` + `transform`). The resize handle is suppressed while
hidden.

`App.tsx` sets `leftHidden={!currentSession}`:

- Overview (no session active): board-only, sidebar hidden.
- Session entered: sidebar reveals with a ~200ms animation.

`cmd+b` collapse and persisted sidebar width are preserved.

## Studios

### Utility studios

Settings, budget, providers, Linear, Sentry, GitLab, workflow, guide are
modal overlays. They are not part of the breadcrumb IA and are exited via
their close button or Esc.

### Workspace creation

`WorkspaceLinkDialog` renders the `Overview > Workspace > Create` breadcrumb
inside its header. After creation it lands on the new workspace board. The
first-run onboarding wizard continues if `isWizardDone` is false.

### Master-detail studios

GitHubStudio, LinearStudio, and similar surfaces use a narrow list rail
alongside a detail panel. This is an intentional master-detail pattern, not
the dual-sidebar anti-pattern. The rule "no surface shows a left panel and a
right panel at once" refers to two sidebars flanking content, which the app
does not do.

## Agent-kind picker

Every agent-creation entry point exposes the `AGENT_KIND` role picker:
`NewSessionView` (first-agent picker) and `SessionOverviewPane` via
`SpawnAgentControl`.

## Session activity bar

The session activity bar shows running sessions only (`stage === 'running'`).
The board surfaces every stage.
