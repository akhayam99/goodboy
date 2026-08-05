# Docs map

The index for Goodboy's documentation. Start here to find the right file for
what you're doing, then load only what your role needs. Every doc has one job
and one owner. If a concept lives in two places, one of them is wrong.

## Role to doc matrix

Which docs each role loads. Rows are roles, a check means "load this when
working in that role". Load top to bottom: a role rarely needs every doc at
once, so pull the deep-dive only when the task touches it.

| Doc                                                     | scout | planner | implementer | reviewer | pr-release | autonomy | onboarding |
| ------------------------------------------------------- | :---: | :-----: | :---------: | :------: | :--------: | :------: | :--------: |
| [README.md](../README.md)                               |       |         |             |          |            |          |     ✓      |
| [VISION.md](../VISION.md)                               |   ✓   |    ✓    |             |          |            |    ✓     |     ✓      |
| [DESIGN.md](../DESIGN.md)                               |       |    ✓    |      ✓      |    ✓     |            |    ✓     |     ✓      |
| [AUTONOMY.md](../AUTONOMY.md) + [cluster](autonomy/)    |       |         |             |          |     ✓      |    ✓     |     ✓      |
| [AGENTS.md](../AGENTS.md)                               |   ✓   |    ✓    |      ✓      |    ✓     |            |    ✓     |     ✓      |
| [CONVENTIONS.md](../CONVENTIONS.md)                     |       |    ✓    |      ✓      |    ✓     |     ✓      |    ✓     |     ✓      |
| [glossary.md](glossary.md)                              |   ✓   |    ✓    |      ✓      |    ✓     |            |          |     ✓      |
| [typescript.md](typescript.md) + [cluster](typescript/) |       |         |      ✓      |    ✓     |            |          |            |
| [styling.md](styling.md)                                |       |         |      ✓      |    ✓     |            |          |            |
| [tone-of-voice.md](tone-of-voice.md)                    |       |         |      ✓      |    ✓     |     ✓      |    ✓     |            |
| [providers.md](providers.md)                            |   ✓   |    ✓    |      ✓      |          |            |          |     ✓      |
| [model-picker.md](model-picker.md)                      |       |    ✓    |      ✓      |    ✓     |            |          |            |
| [release.md](release.md)                                |       |         |             |          |     ✓      |          |            |
| [release-command.md](release-command.md)                |       |         |             |          |     ✓      |    ✓     |            |
| [workflows.md](workflows.md)                            |       |    ✓    |      ✓      |    ✓     |            |          |            |
| [file-system.md](file-system.md)                        |   ✓   |    ✓    |      ✓      |    ✓     |            |          |     ✓      |
| [architecture.md](architecture.md)                      |   ✓   |    ✓    |      ✓      |    ✓     |            |          |     ✓      |
| [testing.md](testing.md)                                |       |    ✓    |      ✓      |    ✓     |            |          |            |
| [dependencies.md](dependencies.md)                      |       |    ✓    |      ✓      |    ✓     |            |          |            |
| per-workspace `CONVENTIONS.md` / `README.md`            |       |         |      ✓      |    ✓     |            |          |     ✓      |

## Reference map

The graph is hub and spoke, never a lateral web.

- **Two code hubs.** [AGENTS.md](../AGENTS.md) is the code hub: it holds the
  working-memory floor every code agent keeps in mind (forbidden-patterns
  checklist plus a hard-rules summary). [CONVENTIONS.md](../CONVENTIONS.md) is
  the process and monorepo hub (pnpm, turbo, tsconfig, ci, git, release).
- **Spokes are the deep dives** under `docs/`. Each spoke owns one concept in
  full. A hub carries the summary and points up to the spoke for the rest.
- **Summary down, deep dive up.** A hub may restate a rule in one line as a
  floor an agent must hold. The full explanation, examples, and edge cases live
  in the spoke. Never the reverse: a spoke does not re-summarize the hub.
- **No lateral duplication.** Spokes do not copy from each other. When two
  spokes need the same fact, one owns it and the other links to it. There is a
  single source of truth per concept.

## Guidelines for future additions

When you add or move documentation, follow these or the map rots.

- **Single source per concept.** A fact lives in exactly one doc. Everywhere
  else links to it. If you find yourself copying a paragraph, link instead.
- **Naming.** Root hubs are CAPS (`AGENTS`, `CONVENTIONS`, `DESIGN`, `VISION`,
  `README`). Topic docs are kebab-case under `docs/` (`tone-of-voice.md`,
  `release-command.md`).
- **Clusters.** When a topic outgrows one file, split it into `docs/<name>/`
  with granular files plus a thin twin index `docs/<name>.md` that links them
  (the `typescript` pattern). The twin index stays short: one line per cluster
  file.
- **Split threshold.** Split only when a doc passes one screen AND has at least
  three subtopics that load independently. Do not pre-split a short doc into a
  cluster.
- **Register here.** Every new doc gets a row in the role matrix and an entry in
  the registry below. An unregistered doc is an orphan.
- **Header pointer.** Open each doc with a one-line statement of what it owns and
  a pointer to its hub or related docs, so a reader landing cold knows the scope.
- **Inline is floor, extract is reference.** Keep in a hub only what an agent
  must hold in working memory (the floor). Push the reference material that is
  loaded on demand out to a granular `docs/*` spoke.

## Registry

Every doc, its one-line purpose, and the roles that load it.

### Hubs (root)

| Doc                                 | Purpose                                                                                                             | Roles                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [README.md](../README.md)           | Product overview, install, run, provider table.                                                                     | onboarding                                                       |
| [VISION.md](../VISION.md)           | The why, the mission, core concepts (workspaces, sessions, agents, workflows, shared context).                      | scout, planner, autonomy, onboarding                             |
| [DESIGN.md](../DESIGN.md)           | Surface principles: how Goodboy looks, reads, and feels. Points to styling.md for mechanics.                        | planner, implementer, reviewer, autonomy, onboarding             |
| [AGENTS.md](../AGENTS.md)           | Code hub. Working-memory floor: forbidden patterns checklist plus hard-rules summary. Points up to granular spokes. | all code roles, autonomy, onboarding                             |
| [AUTONOMY.md](../AUTONOMY.md)       | Autonomy hub: how Goodboy ships itself, the delivery org model and the floor. Points to docs/autonomy/.             | autonomy, pr-release, onboarding                                 |
| [CONVENTIONS.md](../CONVENTIONS.md) | Process and monorepo hub: pnpm, turbo, tsconfig, ci, git workflow, release.                                         | planner, implementer, reviewer, pr-release, autonomy, onboarding |

### Spokes (`docs/`)

| Doc                                                         | Purpose                                                                                           | Roles                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [glossary.md](glossary.md)                                  | Canonical term definitions for code, UI, docs, and issues.                                        | all                                         |
| [autonomy.md](autonomy.md) + [autonomy/](autonomy/)         | Autonomy cluster: roles, safety and trust, release loop, issue triage, watchdogs.                 | autonomy, pr-release                        |
| [typescript.md](typescript.md) + [typescript/](typescript/) | TypeScript conventions cluster: thin twin index plus data, components, control-flow, readability. | implementer, reviewer                       |
| [styling.md](styling.md)                                    | Concrete Tailwind rules for spacing, radius, scroll. DESIGN.md owns the principles.               | implementer, reviewer                       |
| [tone-of-voice.md](tone-of-voice.md)                        | How Goodboy talks: README, website, release notes, in-app copy, errors.                           | implementer, reviewer, pr-release, autonomy |
| [providers.md](providers.md)                                | Provider integration guide: install, connect, manage each CLI.                                    | scout, planner, implementer, onboarding     |
| [model-picker.md](model-picker.md)                          | Model picker structure: catalog presentation data, axes, Cursor Max Mode.                         | planner, implementer, reviewer              |
| [release.md](release.md)                                    | Technical release runbook: signing, notarization, updater, homebrew.                              | pr-release                                  |
| [release-command.md](release-command.md)                    | Agent release playbook: step order and gotchas. Points to release.md for mechanics.               | pr-release, autonomy                        |
| [workflows.md](workflows.md)                                | Workflow tables, run advance gate, post-step summarizer, parallel status.                         | planner, implementer, reviewer              |
| [file-system.md](file-system.md)                            | File layout and where new code goes.                                                              | all code roles, onboarding                  |
| [architecture.md](architecture.md)                          | Repo architecture, subprocess env, provider system, vscode integration.                           | all code roles, onboarding                  |
| [testing.md](testing.md)                                    | Test rules and the golden rule.                                                                   | planner, implementer, reviewer              |
| [dependencies.md](dependencies.md)                          | Dependency policy, single source of truth.                                                        | planner, implementer, reviewer              |

### Per-workspace

| Doc                                                         | Purpose                                                              | Roles                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| `apps/desktop/CONVENTIONS.md`, `apps/desktop/README.md`     | Tauri 2 desktop app: stack-specific rules and dev loop.              | implementer, reviewer, onboarding |
| `packages/ui/CONVENTIONS.md`, `packages/ui/README.md`       | `@goodboy/ui`: presentational-only React 19 component library rules. | implementer, reviewer, onboarding |
| `packages/core/CONVENTIONS.md`, `packages/core/README.md`   | `@goodboy/core`: business logic and orchestration rules.             | implementer, reviewer, onboarding |
| `packages/db/CONVENTIONS.md`                                | `@goodboy/db`: SQLite persistence rules.                             | implementer, reviewer, onboarding |
| `packages/types/CONVENTIONS.md`, `packages/types/README.md` | `@goodboy/types`: shared type definitions rules.                     | implementer, reviewer, onboarding |
