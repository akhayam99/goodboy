# Auto

> **Read this when** you change or explain the Lead, the Auto agent in code: its release gate,
> how a person starts it, what it shows in the Overview and its chat,
> how a plan is approved, and which providers it may use. **Not for** the
> tables and the scheduler behind it ([architecture.md](architecture.md), Auto
> tree registry) or
> what a role is ([concepts.md](concepts.md)).

This page is the map: how the Lead works in a few paragraphs, then the pages
under [auto/](auto/) that hold the detail.

## How the Lead works

Auto is the agent the screens call the Lead. It answers questions itself and
hands the work it cannot do alone to agents of the right role, with a model it
picks for each. It waits for their results, reads them and goes on. It is always
on, with no switch to turn it off. An Auto conversation is a row of the session's
one **Runs** entry ("Lead", or "Lead · plan X" when it follows a preset). Auto
starts agents of the role it picks (`AUTO_ROLE_WHEN`), and agents started by
hand keep working.

Each Lead is an Auto tree: the root agent (role `auto`) and the children it
delegated, created at the start. Its phase, generation, spend cap and permission
rows live in `auto_trees` ([architecture.md](architecture.md)).

1. Everything Auto must read is a row of the tree's outbox: a `user` message, the
   `results` of a batch, a `refusal`. Even the goal is queued there.
2. A delivery claims the pending rows and runs one Auto turn with them.
3. Auto ends the turn with at most one `<<auto>>` block, which the runtime
   applies: admit children, answer, stop, mount a project, or finish.
4. Admitted children start while a run slot is free and settle back to Auto; the
   next delivery carries their results.

A stop moves the generation on, so a late answer for an older generation writes
nothing.

The permission rows are the rules for everyone. The engine reads them on every
launch, publish, admission and finish (`readLaunchPermissions`,
`readPublishPermissions`, `readAdmissionPermissions`, `readIsLeadClosing`), and a
message reaches the Lead while its agents work. A `work.enabled` row left in the
settings table is never read: `upgradeFromSwitchOff.sqlite.test.ts` pins that
pending asks survive, and `upgradeFromSwitchOn.sqlite.test.ts` that the rows a
Lead set for itself stay and a new Lead takes the workspace default.

## Names

The engine keeps the name auto in code; the screens never say it for the unit
of work. One map, read it before a rename:

| Screen and docs                     | Code                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Run, led by a Lead                  | an Auto tree: `auto_trees` (m230), `features/auto/`, `store/runtime/auto/` |
| Lead                                | the root agent of the tree, role `auto` (`NAMES.role.auto` is Lead)        |
| Row "Lead", "Lead · plan X"         | `SessionRun` kind `auto`, worded by `runKindLineOf`                        |
| Lead asks you, permission rows      | `auto.permissions`, `auto_trees.permissions` (m243)                        |
| Older run "Workflow · Orchestrated" | `session_workflows` with `execution_mode` (m091), kind `orchestrated`      |

New runs never start the orchestrator; an open orchestrated run finishes on it,
and the orchestrator goes no earlier than two minor releases after 0.38.0
([features/workflows.md](features/workflows.md#older-runs)). No migration moves a
row between the two engines.

## Status

The feature is on: `AUTO_GATES.isDelegationEnabled` is `true` and is the only
gate. It reaches the screens through `AutoReleaseContext`, and `useIsAutoOn`, the
agent menu facts and `moveToAuto` read only the gate. A build with the gate false
hides the Auto start and every Auto control and keeps the role start, and
`autoUnavailableReason` says "The Lead isn't available in this build."

The runtime (`startAutoRuntime`) runs in the main window, ticks every 15 seconds
from its start (`AUTO_TICK_MS`) and drives the trees that exist. Another window
has no runtime: it hands Stop, Retry, a message to the Lead and a confirm answer
to the main window over a Tauri event (`features/auto/bridge/`:
`createAutoBridgeClient` there, `serveAutoBridge` in main) and waits up to 30
seconds. No answer reads "The main window did not answer. Do it from the main
window." on the tail.

## Pages

| Page                                                  | Open it when you change                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [starting.md](auto/starting.md)                       | **Start a run**, moving an agent to the Lead, rebase conflicts, what a start stores |
| [messages.md](auto/messages.md)                       | A message to the Lead, the queue above the composer, Send to Lead, files            |
| [limits.md](auto/limits.md)                           | The spend limit, No limit, the session cap, money on screen                         |
| [chat.md](auto/chat.md)                               | The Lead's page, glance line, dock, cards and Overview row                          |
| [children.md](auto/children.md)                       | A child's line, name, stuck state, result card, page and composer                   |
| [lead-page.md](auto/lead-page.md)                     | The tree model, the Lead page frame, the state words, the ⌘K rows                   |
| [workflows-and-plans.md](auto/workflows-and-plans.md) | A run on a workflow, the hold card, plan approval, the Next step card               |
| [stops.md](auto/stops.md)                             | Blocks and Retry, caps on returns, run slots, the idle clock, deleting a root       |
| [blocks.md](auto/blocks.md)                           | The `<<auto>>` actions, applying a block once, refusals, the delivery text          |
| [projects.md](auto/projects.md)                       | The `mount` block, the project ask, a child's folder                                |
| [permissions.md](auto/permissions.md)                 | Levels, permission rows, admission, asks and the action bar                         |
| [publish.md](auto/publish.md)                         | The push and pull request gates                                                     |
| [pushing.md](auto/pushing.md)                         | Why children never push, Goodboy's push, force push and its undo                    |
| [launch-guard.md](auto/launch-guard.md)               | The dependency and protected file rows, the landing backstop                        |
| [roles.md](auto/roles.md)                             | Role choice, role fit, read-only roles, Scribe, Rewriter, branch facts              |
| [returns.md](auto/returns.md)                         | The child brief, returns and their decisions, the excerpt, substeps                 |
| [results.md](auto/results.md)                         | Changed files, checks, the remote watch, the outcome line                           |
| [providers.md](auto/providers.md)                     | Where the Lead and its children run, helper routing                                 |

## Talking to Auto

A message to the root of a tree is never a plain turn: it becomes a `user` outbox
row read with the next delivery, and the chat holds only what Auto read (**One
queue**). See [auto/messages.md](auto/messages.md).

## The chat

The Lead page shows the chat, its dock and its cards; a child opens on its own
page with one composer (**Talking to a child**). See
[auto/chat.md](auto/chat.md) and [auto/children.md](auto/children.md).

## The Lead page

`LeadPage` frames a run: the Agents rail on the left, the shown agent's page in
the centre. See [auto/lead-page.md](auto/lead-page.md#the-lead-page).

## Following a workflow

A run started on a workflow keeps one record of it on its tree, and admission
holds writers until its first check passes. See
[auto/workflows-and-plans.md](auto/workflows-and-plans.md#following-a-workflow).

## What stops an Auto tree

No fixed count of agents, runs or turns ends a tree; the spend cap, the caps on
returns and the no progress streak do. See
[auto/stops.md](auto/stops.md#what-stops-an-auto-tree) and
[auto/limits.md](auto/limits.md).

## How Auto decides

Auto runs read-only and ends its final reply with at most one `<<auto>>` block.
See [auto/blocks.md](auto/blocks.md) and, for the gates,
[auto/permissions.md](auto/permissions.md).

### Publish gates

The Push a branch and Open or update a pull request rows are enforced in
Goodboy's own publish step, never in the agent. See
[auto/publish.md](auto/publish.md).

### Launch guard

The Add or upgrade dependencies and Change protected files rows are enforced
when a writer starts, with a backstop when its work lands. See
[auto/launch-guard.md](auto/launch-guard.md).

## Providers

Auto runs on every provider that can confine a read-only agent
(`AUTO_OWN_PROVIDERS`), never on the opencode family, and a writing child only on
Claude and Codex. See [auto/providers.md](auto/providers.md).
