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
- [auto.md](./auto.md): how the Auto agent starts, hands work to other roles
  and shows it, and its release gate
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
| bootstrap      | `apps/desktop/src/features/bootstrap/**`                       | [architecture.md](architecture.md)                                 | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| branch         | `apps/desktop/src/features/branch/**`                          | [hosts.md](hosts.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| budget         | `apps/desktop/src/features/budget/**`                          | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| changelog      | `apps/desktop/src/features/changelog/**`                       | [release.md](release.md)                                           | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| chat           | `apps/desktop/src/features/chat/**`                            | [turns.md](turns.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| companion      | `apps/desktop/src/features/companion/**`                       | [companion.md](companion.md)                                       | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| diff           | `apps/desktop/src/features/diff/**`                            | [navigation/branch-page.md](navigation/branch-page.md)             | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| explore        | `apps/desktop/src/features/explore/**`                         | [navigation/lens-surfaces.md](navigation/lens-surfaces.md)         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| impact         | `apps/desktop/src/features/impact/**`                          | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| integrations   | `apps/desktop/src/features/integrations/**`                    | [hosts.md](hosts.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| live-state     | `apps/desktop/src/features/live-state/**`                      | [turns.md](turns.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| monitoring     | `apps/desktop/src/features/monitoring/**`                      | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| palette        | `apps/desktop/src/features/palette/**`                         | [navigation/shell.md](navigation/shell.md)                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| permissions    | `apps/desktop/src/features/permissions/**`                     | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| plans          | `apps/desktop/src/features/plans/**`                           | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| quick-actions  | `apps/desktop/src/features/quick-actions/**`                   | [navigation/model.md](navigation/model.md)                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| reports        | `apps/desktop/src/features/reports/**`                         | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| resolve        | `apps/desktop/src/features/resolve/**`                         | [hosts.md](hosts.md)                                               | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| scripts        | `apps/desktop/src/features/scripts/**`                         | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| settings       | `apps/desktop/src/features/settings/**`                        | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
| skills         | `apps/desktop/src/features/skills/**`                          | [concepts.md](concepts.md)                                         | [store-slice-action](recipes/store-slice-action.md), [mock-scene](recipes/mock-scene.md)                                              | rules, doc-refs, scenes          |
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

- [concepts.md](./concepts.md): when you need to know what something in the
  app is, or how far an integration goes.
- [DESIGN.md](../DESIGN.md): when you are judging whether a screen or flow
  is right, against the three questions and the north star.
- [AGENTS.md](../AGENTS.md): when you are an agent about to write code here.
  It has the minimum you need to remember and the list of patterns you
  must not use.
- [CONVENTIONS.md](../CONVENTIONS.md): when you need the process rules for
  the whole repo, for pnpm, git, commits or CI.
- [SECURITY.md](../SECURITY.md): when you want to report a vulnerability, or
  check what Goodboy does with your data before a change ships.

## Task docs

- [file-system.md](file-system.md): when you decide where a new file or
  folder goes inside `apps/desktop/src/`.
- [navigation.md](navigation.md): when you decide which parts of the screen
  exist and where they sit, like a pane, the left column, a strip or the
  breadcrumb. It is the index of seven pages in
  [navigation/](navigation/): [the model](navigation/model.md),
  [the shell](navigation/shell.md),
  [the session rail](navigation/session-rail.md),
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
  a bug and you are about to fix it.
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

- [keyboard.md](keyboard.md): when a contextual shortcut takes precedence over a global action.

These docs are kept on purpose. Nobody reads them ahead of time. Open one
only when your task reaches the case it covers.

- [architecture.md](architecture.md): when you change the systems that run
  behind the app, like the environment agents run in, how a provider gets
  picked, the boot path, git status reads, or DB migrations.
- [rust.md](rust.md): when you write or review Rust under `src-tauri`, like
  command errors, the one clock, or the shape of a wire struct.
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
  paired phone may ask for, or when the pairing listener runs.
- [mounts.md](mounts.md): when you change where a session writes on disk,
  the mount lifecycle, the mount operation log, or recovery.
- [workflows.md](workflows.md): when you touch the workflow tables, the
  logic that moves a run to its next step, or the summary written after
  each step.
- [turns.md](turns.md): when you change how a turn picks its route, starts
  and reads a CLI, falls back on failure, or hands off to the session
  summarizer, or how a read-only workspace chat turn runs.
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
  release and needs the steps in order, plus the problems that hit past
  releases.
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
