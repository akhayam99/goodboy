# Docs map

> **Read this when** you want to know which doc to open for a task, before
> you open it. **Not for** the rules themselves. This file only points to
> the doc that holds them.

Each topic in Goodboy is explained in one doc only. When another doc needs
that topic, it links to that doc instead of repeating it. That way there is
never a second copy that goes out of date.

Product direction and the autonomous delivery organization live in the
private `goodboy-atlas` repository. Ask the owner if you need access.

## Using Goodboy

- [first-session.md](./first-session.md): from install to a merged pull request,
  in five steps
- [walkthroughs](./walkthroughs/): three short paths, fix a failing check,
  comment on a plan and review a pull request with comments in place
- [concepts.md](./concepts.md): what a task, a session or an integration is
  in the app
- [workflows.md](./workflows.md): how steps, providers and models work
  together in one run
- [providers.md](./providers.md): how to install, connect or manage a
  provider CLI
- [auto.md](./auto.md): how the Lead (the Auto agent in code) starts, hands
  work to other roles and shows it, and its release gate
  - [auto/starting.md](./auto/starting.md), [auto/messages.md](./auto/messages.md),
    [auto/limits.md](./auto/limits.md): starting a Lead, messages to it, its spend limit
  - [auto/chat.md](./auto/chat.md), [auto/children.md](./auto/children.md),
    [auto/lead-page.md](./auto/lead-page.md): the Lead chat, its children on screen,
    the Lead page and its tree
  - [auto/workflows-and-plans.md](./auto/workflows-and-plans.md),
    [auto/stops.md](./auto/stops.md): workflows, plans and confirming; what stops a Lead
  - [auto/blocks.md](./auto/blocks.md), [auto/projects.md](./auto/projects.md),
    [auto/roles.md](./auto/roles.md), [auto/returns.md](./auto/returns.md),
    [auto/results.md](./auto/results.md): how the Lead decides, mounts projects,
    picks roles, briefs children, and what a child result holds
  - [auto/permissions.md](./auto/permissions.md), [auto/publish.md](./auto/publish.md),
    [auto/pushing.md](./auto/pushing.md), [auto/launch-guard.md](./auto/launch-guard.md):
    permission rows and asks, publish gates, pushing, the launch guard
  - [auto/providers.md](./auto/providers.md): where the Lead and its children run
- [query-bridge.md](./query-bridge.md): what agents can ask your connected
  tools
- [SECURITY.md](../SECURITY.md): how to report a vulnerability, and what
  Goodboy does with your data
- [CLAUDE.md](../CLAUDE.md): when Claude is working here and needs the few
  notes that are specific to that tool.

## Contributing

- [architecture.md](./architecture.md): the systems that run behind the
  app, including the environment agents run in, how a provider gets
  picked, and database migrations
- [AGENTS.md](../AGENTS.md): the working rules for changing this code, and
  the patterns you must not use
- [CONVENTIONS.md](../CONVENTIONS.md): the process for the whole repo, for
  pnpm, git, commits and CI
- [DESIGN.md](../DESIGN.md): the questions a screen or flow has to answer
  before it ships

Below is the full index. Other docs and agents use it to find their way.

## Root hubs

- [README.md](../README.md): when you are new here, human or agent, and
  want the short recap and the install steps.
- [FEATURES.md](../FEATURES.md): when you want the main features in task order.
  Each entry links to its focused page in [features](features/).
- [DESIGN.md](../DESIGN.md): when you are judging whether a screen or flow
  is right, against the three questions and the north star.
- [AGENTS.md](../AGENTS.md): when you are an agent about to write code here.
  It has the minimum you need to remember and the list of patterns you
  must not use.
- [CONVENTIONS.md](../CONVENTIONS.md): when you need the process rules for
  the whole repo, for pnpm, git, commits or CI.
- [SECURITY.md](../SECURITY.md): when you want to report a vulnerability, or
  check what Goodboy does with your data before a change ships.

## Code-area ownership

`pnpm check:doc-refs` fails when a glob below matches no file. Run `node scripts/split-features.mjs --check` to verify the feature-doc contract, which reads the first two columns of the 19 feature areas.

The recipe column links the steps for the change you are about to make: [recipes](recipes/). The guards column names what fails if a step is skipped: `rules` is `check:rules`, `ratchets` is `check:baselines`, `doc-refs` is `check:doc-refs`, `scenes` is the scene registry test.

| Area           | Source glob                                                    | Owner doc                                                          | Recipes                                                                                                                               | Guards                           |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| inbox          | `apps/desktop/src/features/inbox/**`                           | [features/inbox.md](features/inbox.md)                             | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| workflows      | `apps/desktop/src/features/workflows/**`                       | [features/workflows.md](features/workflows.md)                     | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| agents         | `apps/desktop/src/features/workspace-chat/**`                  | [features/agents.md](features/agents.md)                           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| board          | `apps/desktop/src/features/workspace/components/StageBoard/**` | [features/board.md](features/board.md)                             | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| review         | `apps/desktop/src/features/review/**`                          | [features/review.md](features/review.md)                           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| providers      | `apps/desktop/src/features/providers/**`                       | [features/providers.md](features/providers.md)                     | [add-a-provider](recipes/add-a-provider.md), [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md) | rules, doc-refs, scenes          |
| storage        | `apps/desktop/src/features/storage/**`                         | [features/storage.md](features/storage.md)                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| setup          | `apps/desktop/src/features/onboarding/**`                      | [features/setup.md](features/setup.md)                             | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| start          | `apps/desktop/src/features/session/**`                         | [features/start.md](features/start.md)                             | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| overview       | `apps/desktop/src/features/file-versions/**`                   | [features/overview.md](features/overview.md)                       | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| switching      | `apps/desktop/src/features/notifications/**`                   | [features/switching.md](features/switching.md)                     | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| search         | `apps/desktop/src/features/search/**`                          | [features/search.md](features/search.md)                           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| workspace      | `apps/desktop/src/features/workspace/**`                       | [features/workspace.md](features/workspace.md)                     | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| branch-history | `apps/desktop/src/features/history/**`                         | [features/branch-history.md](features/branch-history.md)           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| artifacts      | `apps/desktop/src/features/artifacts/**`                       | [features/artifacts.md](features/artifacts.md)                     | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| context        | `apps/desktop/src/features/context/**`                         | [features/context.md](features/context.md)                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| security       | `apps/desktop/src/features/backup/**`                          | [features/security.md](features/security.md)                       | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| support        | `apps/desktop/src/features/bug-report/**`                      | [features/support.md](features/support.md)                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| keyboard       | `apps/desktop/src/features/terminal/**`                        | [features/keyboard.md](features/keyboard.md)                       | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| actions        | `apps/desktop/src/features/actions/**`                         | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| attachments    | `apps/desktop/src/features/attachments/**`                     | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| auto           | `apps/desktop/src/features/auto/**`                            | [auto.md](auto.md)                                                 | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| bootstrap      | `apps/desktop/src/features/bootstrap/**`                       | [architecture.md](architecture.md)                                 | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| branch         | `apps/desktop/src/features/branch/**`                          | [hosts.md](hosts.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| browser        | `apps/desktop/src/features/browser/**`                         | [browser.md](browser.md)                                           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| budget         | `apps/desktop/src/features/budget/**`                          | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| changelog      | `apps/desktop/src/features/changelog/**`                       | [release.md](release.md)                                           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| chat           | `apps/desktop/src/features/chat/**`                            | [turns.md](turns.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| companion      | `apps/desktop/src/features/companion/**`                       | [companion.md](companion.md)                                       | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| connections    | `apps/desktop/src/features/connections/**`                     | [navigation/model.md](navigation/model.md)                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| diff           | `apps/desktop/src/features/diff/**`                            | [navigation/branch-page.md](navigation/branch-page.md)             | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| explore        | `apps/desktop/src/features/explore/**`                         | [navigation/lens-surfaces.md](navigation/lens-surfaces.md)         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| impact         | `apps/desktop/src/features/impact/**`                          | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| integrations   | `apps/desktop/src/features/integrations/**`                    | [hosts.md](hosts.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| leads          | `apps/desktop/src/features/work/**`                            | [features/agents.md](features/agents.md)                           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| live-state     | `apps/desktop/src/features/live-state/**`                      | [turns.md](turns.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| monitoring     | `apps/desktop/src/features/monitoring/**`                      | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| open           | `apps/desktop/src/features/open/**`                            | [browser.md](browser.md)                                           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| palette        | `apps/desktop/src/features/palette/**`                         | [navigation/shell.md](navigation/shell.md)                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| permissions    | `apps/desktop/src/features/permissions/**`                     | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| plans          | `apps/desktop/src/features/plans/**`                           | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| quick-actions  | `apps/desktop/src/features/quick-actions/**`                   | [navigation/model.md](navigation/model.md)                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| reports        | `apps/desktop/src/features/reports/**`                         | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| resolve        | `apps/desktop/src/features/resolve/**`                         | [hosts.md](hosts.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| scripts        | `apps/desktop/src/features/scripts/**`                         | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| settings       | `apps/desktop/src/features/settings/**`                        | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| suggestions    | `apps/desktop/src/features/suggestions/**`                     | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| updater        | `apps/desktop/src/features/updater/**`                         | [release.md](release.md)                                           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| wireframes     | `apps/desktop/src/features/wireframes/**`                      | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| workTreeModel  | `apps/desktop/src/features/workTreeModel/**`                   | [mounts.md](mounts.md)                                             | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| worktree       | `apps/desktop/src/features/worktree/**`                        | [mounts.md](mounts.md)                                             | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| store-slices   | `apps/desktop/src/store/slices/**`                             | [typescript/state-writes.md](typescript/state-writes.md)           | [store-slice-action](recipes/store-slice-action.md)                                                                                   | rules, ratchets, store-mocks     |
| shared         | `apps/desktop/src/shared/**`                                   | [file-system.md](file-system.md)                                   | [shared-hook](recipes/shared-hook.md)                                                                                                 | rules, doc-refs                  |
| ui             | `packages/ui/src/**`                                           | [../packages/ui/DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md) | [ui-primitive](recipes/ui-primitive.md)                                                                                               | rules, ratchets                  |
| core           | `packages/core/src/**`                                         | [architecture.md](architecture.md)                                 | [shared-hook](recipes/shared-hook.md)                                                                                                 | rules, lint                      |
| db             | `packages/db/src/**`                                           | [architecture.md](architecture.md)                                 | [migration](recipes/migration.md)                                                                                                     | registry test, rules             |
| tauri          | `apps/desktop/src-tauri/src/**`                                | [rust.md](rust.md), [architecture.md](architecture.md)             | [tauri-command](recipes/tauri-command.md), [host-adapter](recipes/host-adapter.md)                                                    | cargo test, check-tauri-commands |
| website        | `website/src/**`                                               | [release.md](release.md)                                           | [website-page](recipes/website-page.md)                                                                                               | doc-refs                         |

## Task docs

- [concepts.md](./concepts.md): when you need to know what something in the
  app is, or how far an integration goes. It is the hub of the pages in
  [concepts/](concepts/):
  - [workspaces](concepts/workspaces.md): creating, naming and switching a
    workspace, and a plain folder's face
  - [sessions](concepts/sessions.md): stages, Running, Needs you and Done
  - [lazy-sessions](concepts/lazy-sessions.md): when a session gets a worktree,
    mounts and Storage
  - [activity](concepts/activity.md): the Activity and Log feeds and history
    rows
  - [next-steps](concepts/next-steps.md): suggestion kinds, ranking and
    dismissal
  - [agents](concepts/agents.md): agents, the queue, the Lead, kinds and open
    questions
  - [artifacts](concepts/artifacts.md): plans, parts, comments and wireframes
  - [shared-context](concepts/shared-context.md): the session record, lenses
    and Ask
  - [review-comments](concepts/review-comments.md): notes, review
    conversations and comment states
  - [fix-runs](concepts/fix-runs.md): fix runs, pushing and reply wording
  - [settings](concepts/settings.md): setting levels, saves, the profile and
    Open with
  - [permissions](concepts/permissions.md): permission rules and asks
  - [integrations](concepts/integrations.md): bindings, sources and the
    tracker after a merge
  - [tasks](concepts/tasks.md): the Tasks list and what Start mounts
  - [spend](concepts/spend.md): provider routing, spend, limits and Impact
  - [vocabulary](concepts/vocabulary.md): words and labels on screen
  - [identifiers](concepts/identifiers.md): code names and where each concept
    lives
- [file-system.md](file-system.md): when you decide where a new file or
  folder goes inside `apps/desktop/src/`.
- [navigation.md](navigation.md): when you decide which parts of the screen
  exist and where they sit, like a pane, a rail, the top bar or the
  crumbs. It is the index of seven pages in
  [navigation/](navigation/): [the model](navigation/model.md),
  [the shell](navigation/shell.md),
  [the session page tabs and tools](navigation/session-rail.md),
  [studios](navigation/studios.md),
  [lens surfaces](navigation/lens-surfaces.md),
  [home and the right drawer](navigation/home-and-drawer.md) and
  [the Branch page](navigation/branch-page.md).
- [tone-of-voice.md](tone-of-voice.md): when you write any text a user
  reads, like the README, the website, release notes, in-app copy or error
  messages.
- [iconography.md](iconography.md): when you put a glyph on a surface, or
  check which glyph a concept already owns.
- [brand.md](brand.md): when you draw the mascot, the logo with its name,
  an app icon or a social image.
- [website/README.md](../website/README.md): when you change, build or
  check the landing page.
- [providers.md](providers.md): when you install, connect or manage a
  provider CLI.
- [typescript/data.md](typescript/data.md): when you declare a type or a
  data shape.
- [typescript/components.md](typescript/components.md): when you write a
  component's exports, props or ref pattern, or a function's parameters.
- [typescript/control-flow.md](typescript/control-flow.md): when you
  structure conditionals, branches or early returns.
- [typescript/state-writes.md](typescript/state-writes.md): when you write a
  store action, a navigation address, a loader, an undo or a retry.
- [typescript/selectors.md](typescript/selectors.md): when you write a
  `useAppStore` selector or a component that reads several store values.
- [typescript/readability.md](typescript/readability.md): when you name a
  variable or callback, or feel like adding a code comment.
- [testing.md](testing.md): when you write or review tests, and how to
  write their checks.
- [ratchets.md](ratchets.md): when a ratchet or `check:baselines` fails, or
  you add a rule that counts something.
- [dependencies.md](dependencies.md): when you add a new package, or check
  whether one is worth it.
- [traps.md](traps.md): when something in the code or the tools looks like
  a bug and you are about to fix it. It indexes one page per area:
  [rust](traps/rust.md), [providers](traps/providers.md),
  [git](traps/git.md), [review](traps/review.md),
  [resolve](traps/resolve.md), [auto](traps/auto.md),
  [store](traps/store.md), [folders](traps/folders.md),
  [launch](traps/launch.md), [ui](traps/ui.md),
  [scroll](traps/scroll.md), [browser](traps/browser.md),
  [toolchain](traps/toolchain.md) and [database](traps/database.md).
- [packages/ui/DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md): when
  you need the exact tokens, scales, z-index layers or motion to build with.
  It is the registry. A page per family sits beside it:
  [controls](../packages/ui/design/controls.md),
  [feedback and empty states](../packages/ui/design/feedback.md),
  [layout and action grammar](../packages/ui/design/layout.md),
  [surfaces](../packages/ui/design/surfaces.md) and
  [rail and work vocabulary](../packages/ui/design/rail-and-work.md).
- [apps/desktop/CONVENTIONS.md](../apps/desktop/CONVENTIONS.md) and
  [apps/desktop/README.md](../apps/desktop/README.md): what belongs in the
  desktop app and how it is laid out.
- [packages/core/CONVENTIONS.md](../packages/core/CONVENTIONS.md) and
  [packages/core/README.md](../packages/core/README.md): what belongs in
  core and how the package is laid out.
- [packages/db/CONVENTIONS.md](../packages/db/CONVENTIONS.md) and
  [packages/db/README.md](../packages/db/README.md): what belongs in the
  database package and how it is laid out.
- [packages/types/CONVENTIONS.md](../packages/types/CONVENTIONS.md) and
  [packages/types/README.md](../packages/types/README.md): what belongs in
  the shared types and how the package is laid out.
- [packages/ui/CONVENTIONS.md](../packages/ui/CONVENTIONS.md) and
  [packages/ui/README.md](../packages/ui/README.md): what belongs in the
  UI components and how the package is laid out.

## Read on demand

These docs are kept on purpose. Nobody reads them ahead of time. Open one
only when your task reaches the case it covers.

- [architecture.md](architecture.md): when you change the systems that run
  behind the app, like the environment agents run in, how a provider gets
  picked, the boot path, git status reads, or DB migrations. It is the index
  of the pages in [architecture/](architecture/):
  [boot](architecture/boot.md), [commands](architecture/commands.md),
  [frontend](architecture/frontend.md), [logging](architecture/logging.md),
  [environment](architecture/environment.md),
  [processes](architecture/processes.md), [monitor](architecture/monitor.md),
  [terminal output](architecture/terminal-output.md),
  [git](architecture/git.md), [Rust modules](architecture/rust-modules.md),
  [file access](architecture/file-access.md),
  [migrations](architecture/migrations.md),
  [table writers](architecture/table-writers.md),
  [Auto tree registry](architecture/auto-tree-registry.md),
  [data layout](architecture/data-layout.md),
  [project move](architecture/project-move.md),
  [backup](architecture/backup.md),
  [artifact frames](architecture/artifact-frames.md) and
  [untrusted text](architecture/untrusted-text.md).
- [rust.md](rust.md): when you write or review Rust under `src-tauri`, like
  command errors, the one clock, or the shape of a wire struct.
- [keyboard.md](keyboard.md): when you add a contextual shortcut, or change
  which action owns a chord.
- [search.md](search.md): when you change what ⌘F finds, the local search
  index and its triggers, or how a hit lands in its view.
- [model-picker.md](model-picker.md): when you change how a user picks a
  model or effort.
- [event-bus.md](event-bus.md): when you send or listen for a `goodboy:`
  window event, or open a studio from another feature.
- [query-bridge.md](query-bridge.md): when you change what an agent can
  ask a connected tool, or how it asks.
- [hosts.md](hosts.md): when you change what Goodboy does on GitHub, GitLab
  or Bitbucket, or add a host, like merge methods, link shapes or draft
  support.
- [companion.md](companion.md): when you change how a phone pairs, what a
  paired phone may ask for, when the pairing listener runs, or the mobile
  contract.
- [browser.md](browser.md): when you change how a web page opens inside a
  window, where a tab may navigate, or what a page in a tab may reach.
- [mounts.md](mounts.md): when you change where a session writes on disk,
  the mount lifecycle, the mount operation log, or recovery.
- [workflows.md](workflows.md): when you touch the workflow tables, the
  logic that moves a run to its next step, or the summary written after
  each step. Its pages in [workflows/](workflows/):
  [studio](workflows/studio.md), [rules](workflows/rules.md),
  [runs-list](workflows/runs-list.md), [run-pages](workflows/run-pages.md),
  [run-tree](workflows/run-tree.md), [advancing](workflows/advancing.md),
  [plans](workflows/plans.md), [orchestrator](workflows/orchestrator.md),
  [step-end](workflows/step-end.md) and [code-map](workflows/code-map.md).
- [turns.md](turns.md): when you change how a turn picks its route, starts
  and reads a CLI, falls back on failure, or hands off to the session
  summarizer, or how a read-only workspace chat turn runs. The hub maps its
  sub-pages in [turns/](turns/):
  - [turns/pipeline.md](turns/pipeline.md),
    [turns/routing-and-prompt.md](turns/routing-and-prompt.md),
    [turns/write-destination.md](turns/write-destination.md),
    [turns/handoffs.md](turns/handoffs.md): before and around the spawn.
  - [turns/spawn.md](turns/spawn.md), [turns/stream.md](turns/stream.md),
    [turns/recovery.md](turns/recovery.md),
    [turns/failure-and-fallback.md](turns/failure-and-fallback.md): the CLI
    run, its events, reloads and restarts, and failures.
  - [turns/text-reveal.md](turns/text-reveal.md),
    [turns/live-state.md](turns/live-state.md),
    [turns/chat-view.md](turns/chat-view.md),
    [turns/composer.md](turns/composer.md): what the chat shows and sends.
  - [turns/spans-and-estimates.md](turns/spans-and-estimates.md),
    [turns/context-updates.md](turns/context-updates.md): what a turn records
    and the context passes after it.
  - [turns/workspace-chat.md](turns/workspace-chat.md),
    [turns/session-ask.md](turns/session-ask.md): the read-only chat and Ask
    turns.
- [adr/001-workspace-project-rename.md](adr/001-workspace-project-rename.md):
  when you need to know why the schema calls the old workspaces table
  `projects`, or what the 0.2.0 migrations did to existing data.
- [adr/002-boot-path-leaves-the-ui-thread.md](adr/002-boot-path-leaves-the-ui-thread.md):
  when you add or change a Tauri command that the boot sequence reaches, or
  the boot breadcrumb log.
- [adr/003-provider-detection-leaves-the-boot-path.md](adr/003-provider-detection-leaves-the-boot-path.md):
  when you add work to boot or read a provider's connection state.
- [adr/004-git-reads-fail-closed.md](adr/004-git-reads-fail-closed.md): when
  you show or gate on git status, or add a command that changes git.
- [release.md](release.md): when you need the technical detail of a
  release, like signing, notarization, the updater or Homebrew.
- [release-command.md](release-command.md): when an agent is running a
  release and needs the steps in order, the release notes format and the
  Guide alignment.
- [versioning.md](versioning.md): when you pick the next version number or
  wonder why a pull request with a migration waits for a minor release.
- [styling.md](styling.md): when you write spacing, radius, scroll,
  overlay or z-index in code.
- [mock-screenshots.md](mock-screenshots.md): when you need a screenshot
  of the real app filled with fake, rich, non-empty data.

## Routing an ad-hoc agent

An agent with no delivery role reads this section. It stops after the line
that matches its task. Whoever starts the agent points it here.

- Writing a component: `AGENTS.md`, `docs/typescript/components.md`,
  `docs/file-system.md`, `docs/styling.md`, `packages/ui/DESIGN-SYSTEM.md`,
  `docs/testing.md`.
- Changing the schema: `AGENTS.md`, `docs/architecture.md`,
  `docs/testing.md`.
- Touching a release: `docs/release-command.md`, `docs/release.md`,
  `docs/versioning.md`.
- Reviewing a PR: `AGENTS.md`, `CONVENTIONS.md`, `docs/testing.md`.
- Editing docs: this map, the doc that already covers the topic, and
  `docs/tone-of-voice.md` only for text users read.

## Writing and registering docs

- Keep what the code cannot tell you. That means concepts, rules that must
  always hold, who decides what, limits, and reasons that are not obvious.
  Delete structure, lists of files, commands, and anything you can read
  from the repository. Counts and lists of names are allowed only where a
  test or script checks them against the code, or in a runbook step that
  needs them. Paths are allowed as entry points.
- Describe a rule that always holds, not one way to build it. If a sentence
  would stop being true after a reasonable refactor, it describes a
  solution, not a concept.
- Each topic lives in one doc. Every other place links to it.
- Root hubs use capital letters. Topic docs use kebab case under `docs/`.
- A folder of related docs is listed directly in this map. It does not need
  its own small index.
- Before you rename or delete a symbol, file, or route, grep `*.md` for it.
  The `doc refs` CI step fails on a doc that still names it.
- A doc is an orphan when neither this map nor the root hubs link to it.
  An orphan gets listed here or deleted. It never stays unlinked.
- Every doc opens with a `Read this when` header, with two exceptions. The
  release flow writes `CHANGELOG.md`, and agents read it through
  [release-command.md](release-command.md), the doc that owns it. The root
  `README.md` is the public landing page GitHub shows first, and
  `FEATURES.md` is the public feature index it links to; the feature-area
  docs it links to are the guide. Their entries in this map are their headers.
  `.github/pull_request_template.md` is a form
  pasted into every PR body, not a doc.
