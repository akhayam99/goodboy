# Docs map

> **Read this when** you need to decide which documentation a task qualifies
> to load before opening it. **Not for** application or delivery rules; this
> file routes to their owners.

Each concept has one owner. Another document that needs it links to that
owner rather than restating it, so there is never a second copy to drift.

Two things are deliberately not here: where the product is going, and the
autonomous delivery organization that ships it. Both live in `goodboy-atlas`,
a private repository. What the app does today is here, in full. If you are
collaborating on direction rather than on code, ask the owner for access:
contributing here needs nothing from it, it is never reconstructed from what
is here, and an autonomous release cycle is its one reader.

## Root hubs

- [README.md](../README.md): when you are new here, human or agent, and want
  the pitch, install steps, and feature tour.
- [concepts.md](./concepts.md): when you need what an object in the app is,
  or how far an integration goes.
- [DESIGN.md](../DESIGN.md): when you are judging whether a screen or flow is
  right, against the three questions and the north star.
- [AGENTS.md](../AGENTS.md): when you are an agent about to write code here
  and need the working-memory floor and forbidden-patterns checklist.
- [CONVENTIONS.md](../CONVENTIONS.md): when you need monorepo-wide process
  rules: pnpm, git workflow, commits, or CI.
- [SECURITY.md](../SECURITY.md): when you are reporting a vulnerability or
  checking what Goodboy does with user data before a diff ships.

## Task docs

- [file-system.md](file-system.md): when deciding where a new file or folder
  goes inside `apps/desktop/src/`.
- [navigation.md](navigation.md): when deciding what surface exists and where
  it lives: lens, pane, strip, footer, or breadcrumb.
- [tone-of-voice.md](tone-of-voice.md): when writing any user-facing string:
  README, website, release notes, in-app copy, or error messages.
- [brand.md](brand.md): when drawing the mascot, the lockup, an app icon or a
  social image.
- [providers.md](providers.md): when installing, connecting, or managing a
  provider CLI.
- [testing.md](testing.md): when writing or reviewing test coverage and
  assertion style.
- [dependencies.md](dependencies.md): when adding a new package or reviewing
  whether one is justified.
- [traps.md](traps.md): when something in the code or the toolchain looks like
  a bug and you are about to fix it.
- [packages/ui/DESIGN-SYSTEM.md](../packages/ui/DESIGN-SYSTEM.md): when you
  need concrete tokens, scales, or primitives to implement against.
- [apps/desktop/CONVENTIONS.md](../apps/desktop/CONVENTIONS.md) and
  [apps/desktop/README.md](../apps/desktop/README.md): desktop boundaries and
  app shape.
- [packages/core/CONVENTIONS.md](../packages/core/CONVENTIONS.md) and
  [packages/core/README.md](../packages/core/README.md): core boundaries and
  package shape.
- [packages/db/CONVENTIONS.md](../packages/db/CONVENTIONS.md) and
  [packages/db/README.md](../packages/db/README.md): database boundaries and
  package shape.
- [packages/types/CONVENTIONS.md](../packages/types/CONVENTIONS.md) and
  [packages/types/README.md](../packages/types/README.md): shared-type
  boundaries and package shape.
- [packages/ui/CONVENTIONS.md](../packages/ui/CONVENTIONS.md) and
  [packages/ui/README.md](../packages/ui/README.md): presentational boundaries
  and package shape.

## Read on demand

These references are deliberate, not abandoned. Nobody preloads them. Consult
one only when the current task reaches its trigger.

- [README.md](README.md): when you need to decide which documentation a task
  qualifies to load before opening it.
- [typescript.md](typescript.md): when writing TypeScript and you need the
  index into the cluster-specific rule for what you are touching.
- [architecture.md](architecture.md): when touching runtime systems around
  the app: subprocess environment, provider routing, or DB migrations.
- [model-picker.md](model-picker.md): when changing how a user picks a model or
  effort.
- [query-bridge.md](query-bridge.md): when changing what a spawned agent can
  ask a connected integration, or how it asks.
- [workflows.md](workflows.md): when touching workflow tables, run advance
  logic, or the post-step summarizer.
- [adr/001-workspace-project-rename.md](adr/001-workspace-project-rename.md):
  when you need why the schema calls the old workspaces table `projects`, or
  what the 0.2.0 migrations did to existing data.
- [release.md](release.md): when you need the technical detail of a release:
  signing, notarization, updater, or Homebrew.
- [release-command.md](release-command.md): when an agent is executing a
  release and needs the step order plus the gotchas that bit previous runs.
- [styling.md](styling.md): when implementing spacing, radius, scroll, overlay,
  or z-index in code.

## Routing an ad-hoc agent

An agent with no delivery role reads this section and stops after its task
shape. Whoever spawns it points here explicitly.

- Writing a component: `AGENTS.md`, `docs/typescript/components.md`,
  `docs/file-system.md`.
- Changing the schema: `AGENTS.md`, `docs/architecture.md`,
  `docs/testing.md`.
- Touching a release: `docs/release-command.md`, `docs/release.md`.
- Reviewing a PR: `AGENTS.md`, `CONVENTIONS.md`, `docs/testing.md`.
- Editing docs: this router, the existing owner of the concept, and
  `docs/tone-of-voice.md` only for user-facing copy.

## Writing and registering docs

- Keep concepts, invariants, authority, ceilings, and non-obvious reasons.
  Delete structure, inventories, paths, commands, counts, and facts recoverable
  from the repository.
- Prefer an invariant over one implementation. A sentence that fails after a
  plausible refactor describes a solution, not a concept.
- Single source per concept. Another context links to the owner.
- Root hubs use capitals; topic docs use kebab case under `docs/`.
- A cluster directory is registered directly in this router. It needs no thin
  twin index.
- A doc is an orphan when this router and the root hubs both fail to reach it.
  An orphan is either registered here or deleted; it is never left floating.
- Generated files carry no `Read this when` header: `CHANGELOG.md` is written
  by the release flow and read through
  [release-command.md](release-command.md), its concept owner. That is the one
  header exception.
