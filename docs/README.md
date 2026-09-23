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

- [concepts.md](./concepts.md): what a task, a session or an integration is
  in the app
- [workflows.md](./workflows.md): how steps, providers and models work
  together in one run
- [providers.md](./providers.md): how to install, connect or manage a
  provider CLI
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
  want the pitch, the install steps and the feature tour.
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
  exist and where they sit, like a pane, the sidebar, a strip, the footer
  or the breadcrumb.
- [tone-of-voice.md](tone-of-voice.md): when you write any text a user
  reads, like the README, the website, release notes, in-app copy or error
  messages.
- [iconography.md](iconography.md): when you put a glyph on a surface, or
  check which glyph a concept already owns.
- [brand.md](brand.md): when you draw the mascot, the logo with its name,
  an app icon or a social image.
- [providers.md](providers.md): when you install, connect or manage a
  provider CLI.
- [typescript/data.md](typescript/data.md): when you declare a type or a
  data shape.
- [typescript/components.md](typescript/components.md): when you write a
  component's exports, props or ref pattern, or a function's parameters.
- [typescript/control-flow.md](typescript/control-flow.md): when you
  structure conditionals, branches or early returns.
- [typescript/readability.md](typescript/readability.md): when you name a
  variable or callback, or feel like adding a code comment.
- [testing.md](testing.md): when you write or review tests, and how to
  write their checks.
- [dependencies.md](dependencies.md): when you add a new package, or check
  whether one is worth it.
- [traps.md](traps.md): when something in the code or the tools looks like
  a bug and you are about to fix it.
- [packages/ui/DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md): when
  you need the exact tokens, scales or base components to build with.
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
  picked, or DB migrations.
- [model-picker.md](model-picker.md): when you change how a user picks a
  model or effort.
- [event-bus.md](event-bus.md): when you send or listen for a `goodboy:`
  window event, or open a studio from another feature.
- [query-bridge.md](query-bridge.md): when you change what an agent can
  ask a connected tool, or how it asks.
- [companion.md](companion.md): when you change how a phone pairs, what a
  paired phone may ask for, or when the pairing listener runs.
- [mounts.md](mounts.md): when you change where a session writes on disk,
  the mount lifecycle, the mount operation log, or recovery.
- [workflows.md](workflows.md): when you touch the workflow tables, the
  logic that moves a run to its next step, or the summary written after
  each step.
- [adr/001-workspace-project-rename.md](adr/001-workspace-project-rename.md):
  when you need to know why the schema calls the old workspaces table
  `projects`, or what the 0.2.0 migrations did to existing data.
- [release.md](release.md): when you need the technical detail of a
  release, like signing, notarization, the updater or Homebrew.
- [release-command.md](release-command.md): when an agent is running a
  release and needs the steps in order, plus the problems that hit past
  releases.
- [styling.md](styling.md): when you write spacing, radius, scroll,
  overlay or z-index in code.
- [mock-screenshots.md](mock-screenshots.md): when you need a screenshot
  of the real app filled with fake, rich, non-empty data.

## Routing an ad-hoc agent

An agent with no delivery role reads this section. It stops after the line
that matches its task. Whoever starts the agent points it here.

- Writing a component: `AGENTS.md`, `docs/typescript/components.md`,
  `docs/file-system.md`.
- Changing the schema: `AGENTS.md`, `docs/architecture.md`,
  `docs/testing.md`.
- Touching a release: `docs/release-command.md`, `docs/release.md`.
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
  `README.md` is the public landing page GitHub shows first, and its entry
  in this map is its header. `.github/pull_request_template.md` is a form
  pasted into every PR body, not a doc.
