# Lead permissions and asks

> **Read this when** you change what a Lead may do alone: the Asks you levels,
> the nine permission rows, how admission reads them, an ask and its answer by
> id, or the action bar in the dock. **Not for** the publish step that enforces
> the push and pull request rows ([publish.md](publish.md)) or the launch guard
> that enforces the dependency and protected file rows
> ([launch-guard.md](launch-guard.md)).

## The levels

The Asks you level has the three values of workflows and its own default,
**After the plan**. Force pushes ask with a backup at every level.

| Level              | What it does                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Every step**     | Confirms each child, and wants a planner's plan before a change                                             |
| **After the plan** | Readers start freely; a writer needs a planner's plan and your approval, then handoffs go on asking nothing |
| **Never**          | The plan is optional; Auto chooses and delegates without proposing a next step                              |

Each turn reads the session's level (`autoSystemPromptOf` through
`readAutoLevel`), and a read that fails fails the turn instead of guessing.
`buildAutoSystemPrompt` defaults to `DEFAULT_AUTO_LEVEL`
(`packages/core/src/auto/level.ts`), and `buildTurnSpawn` rebuilds it with that
default for every Auto turn. The level's planning text beats the role guidance
([roles.md](roles.md)). Admission reads the permission rows, whose presets are
the levels.

### Storage

`store/runtime/auto/level/` keeps session overrides and a workspace default in
the workspace value `auto.level` (key registered in
`packages/db/src/queries/entity-value.ts`). A session falls back to the
workspace, then **After the plan**; an invalid value falls through. A write names
its session or workspace, compares and swaps, retries one lost race and reports a
failure without touching window state. `changeAutoLevel` queues picks per
workspace, so the last pick wins.

### The level chip

`AutoLevelChip` shows on **Start a run** and in an Auto agent's settings line
(`AutoLevelSetting`, beside the Limit chip). `AgentSettingsLine` renders it
itself, never through the composer slot.

- The workspace default is the **Stops for your OK** row of Workflows › **Every
  run**, shared with workflows (`changeStopsLevel`,
  [workflows.md](../workflows.md)).
- `useAutoLevel` (`shared/hooks/`) reads `auto.level` and writes through
  `changeAutoLevel` (`writeAutoLevel`, a reload, a note to the other windows).
  It keeps only the latest pick; a failed write keeps the old level and shows
  why. `startRoutedRun` writes the pick of the start field.

## Permission rows

A Lead's autonomy is nine rows, a spend limit and four locked rows
(`packages/core/src/auto/permissions.ts`, values in `LEAD_PERMISSION_VALUES`).

| Row                           | Values                                 |
| ----------------------------- | -------------------------------------- |
| Approve the plan              | ask, skip                              |
| Start agents that read        | ask, free                              |
| Start agents that write       | ask, after the plan, free              |
| Push a branch                 | ask, when checks pass                  |
| Open or update a pull request | ask, allow each                        |
| Add or upgrade dependencies   | ask, allow each                        |
| Change protected files        | ask, allow each                        |
| Add a project                 | ask, when the session allows it, allow |
| Close the work                | you, Lead                              |

The spend limit is the tree's `cap_usd`. The locked rows are not stored: force
push asks with a backup, merge is you, agents never push, the Lead never writes.

The levels are the presets in `LEAD_PERMISSION_PRESETS`. Every step asks for the
plan, every child and every project; After the plan asks for the plan, lets
readers start and adds a project inside the materialization allowance; Never
skips the plan and starts and adds freely. Push, pull request, dependencies and
protected files sit at their open value in all three. The preset reads Custom
once the rows match none.

### The effective value

`leadPermissionsOf` gives each row its value and source, first match wins:

1. the Lead's own rows (`auto_trees.permissions`, m243);
2. the workspace default (`auto.permissions`);
3. the session's level, then the workspace level, then **After the plan**.

The hidden `agents.autoPlanApproval` setting stands in for Approve the plan
while no stored row holds it; a stored Ask is never overridden by it. Start
agents that write at After the plan with Approve the plan at Skip cannot both
hold: when either comes from a stored row it reads Ask with a
`LeadPermissionNote`; when the skip comes from the setting and the writer row
from a level, it reads free.

### Reading and writing

`readLeadPermissions.ts` reads a tree, session or workspace target.
`writeLeadPermission.ts` writes one row on the workspace default or one Lead
(`setAutoTreePermissionsIfUnchanged`), each a compare and swap. A null value is
Reset. A lost swap re-reads and retries once, then fails "changed in another
window". A row tightened while an agent runs applies to its next start.

### The panel and the Stops menu

`LeadPermissionsPanel` (`features/auto/permissions/`) shows the nine rows in
three groups and the locked rows as one line, under the level in `LeadLevelRow`
(the drawer) or the **Stops for your OK** row (Every run).

- `leadDetailsDifferOf` counts the rows that differ from `LeadPermissions.level`,
  the only source of "Custom, 2 details".
- A row saves on change, with no draft. A failed write keeps the old value with
  the error under the row; a failed reread keeps the rows with the error above.
- The readers of a workspace (`useLeadPermissions`) follow one revision
  (`leadPermissionsRevisionByWorkspace`, slice `lead-permissions`), bumped only
  by a write that landed. Each keeps only its latest answer.
- A level pick writes the level and clears the own rows; on a Lead it pins a row
  only where the workspace default still disagrees. Reset is a pick of the
  current level.

`LeadPermissionsChip` is the **Stops** menu `AutoLevelChip` mounts on a
session's start field and on the Lead page: the three levels, **Reset to** when
the rows differ, and **Fine-tune this run**, which opens the `lead-details`
drawer (`LeadDetailsDrawer`).

- With no Lead yet, a level writes the session only, and the last row is
  **Fine-tune in Settings** (`openRunDefaults`). A run never writes the
  workspace default. A new session draft keeps the chip until the session
  exists.
- On Every run, **Fine-tune what the Lead does alone** opens the default rows in
  the page (`LeadDetailsDisclosure`); a level pick there writes both level keys
  and clears the default rows.
- The drawer is never saved in the window layout (`UNSAVED_DRAWER_KINDS`,
  `savedLocationOf`), so a rollback opens the run without it.

## Admission rows

Admission reads four rows, never the level
(`store/runtime/auto/admission/readAdmissionPermissions.ts`), for each handoff
after resolving the child. With no stored rows the outcome equals the level.
`readAdmissionSnapshot` reads them and `admit.ts` applies them to the child
state, receipt and plan use.

| Row                     | At admission                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Start agents that read  | Whether a reader waits for your confirmation (`admissionStateOf`)                                                                       |
| Start agents that write | The same for a writer; After the plan and Free start it; `confirm: true` still asks                                                     |
| Approve the plan        | The plan gate for a writer that takes a plan (`isAdmissionPlanGateOn`, also inside the transaction through `inputArtifactStatementsOf`) |
| Add a project           | The mount mode of `applyMountBlock`                                                                                                     |

At **Never** a writer may use an unapproved plan; revision and artifact checks
still apply ([blocks.md](blocks.md#a-plan-feeds-one-writer-per-role)).

### Changes before the launch or the confirm

Changing the level or a row never starts a waiting child, and never loosens a
proposal.

- When `launchChildren` claims an accepted child, `isStartRowHeld` reads its
  start row again and moves it back to `awaiting_confirm` if it now asks. Only a
  start you confirmed skips this: `confirmDelegation` writes
  `request.isStartConfirmed`, `continueChild` from you carries it, admission
  writes it false, so a retry never inherits it.
- `confirmDelegation` reads Approve the plan again and, if it now asks, checks in
  its transaction that the writer's plan is approved at the revision it took
  (`readPlanApprovalGuards`). If not it returns `refused`, the proposal stays and
  the bar shows `CONFIRM_REFUSED_REASON`; the way out is to decline. Two confirms
  start one child (the second reads `lost`).

## Asks

Every ask has one id. `store/runtime/auto/asks/leadAsksOf.ts` lists them per
tree; a stopped or finished Lead lists none. Counts are by id, and one need named
twice by an attempt is one row (`insertAutoGrantStatement`). The plan and a
project ask have their own flows.

| Ask                                          | Id                           | Row                                  |
| -------------------------------------------- | ---------------------------- | ------------------------------------ |
| A start that waits for you                   | `start:<delegation>`         | Delegation in `awaiting_confirm`     |
| A push that waits                            | `push:<delegation>:<commit>` | Publish record in `awaiting_confirm` |
| A dependency, protected file or pull request | `grant:<id>`                 | One `auto_grants` row                |

### Grant rows

A grant (`packages/db/src/queries/auto-grants.ts`) is asked, allowed, declined or
used. It is bound to the attempt that asked, and is current while that attempt is
its delegation's latest in the tree's generation. A pull request grant is bound
to one version of its text instead, current while its delegation is of the
generation and no newer text was asked for the subject, so Stop makes it stale.

- `answerAutoGrantStatement` moves only a current, asked row, so a second answer
  or one for a superseded attempt or text is dropped.
- An allowance is used up at launch: `markAutoGrantUsedStatement` sits in the
  transaction that inserts the next attempt
  ([launch-guard.md](launch-guard.md#at-the-start)). A crash after Allow
  relaunches with it; a second launch with it aborts.

### Answering

`answerAsk` (`store/runtime/auto/asks/answerAsk.ts`) answers an ask by id in the
main window: a start goes to `confirmDelegation`, a push to the publish act once
it still waits for that commit, a grant to `answerGrant` (guards the tree: not
stopped, owner lease; moves the row, bumps the phase revision, drives the tree), and a pull request grant on
to `answerPullRequest` ([publish.md](publish.md#pull-request)).

It returns allowed, declined or settled (dropped). `createAskAnswerer` runs one
answer per id at a time: the same answer shares the result, a different one is
settled. Another window answers through the bridge
(`features/auto/askAnswerPort.ts`).

## Action bar asks

`AutoDock` draws the first push, pull request, dependency or protected file ask
(`chat/askBarOf.ts`) in `AutoDockAsk`, after the plan and the next step: one
state, one primary, one quiet answer, and "+N more".

| Ask              | Labels                                          |
| ---------------- | ----------------------------------------------- |
| Push             | Push or Force push / Don't push                 |
| Pull request     | Open the pull request / Not yet                 |
| Dependency, file | Allow the named package or file / Do it without |

- The right end names the row, its value and its source
  (`chat/hooks/useAskPermissionRow/index.ts`).
- The answer goes through `answerAsk` by ask id
  (`chat/hooks/useAnswerAsk/index.ts`), so a second answer to the same ask is
  dropped. A failure or a `refused` answer (`CONFIRM_REFUSED_REASON`) keeps the
  ask with the reason; an ask answered elsewhere leaves on the next read.
- A pull request ask whose save threw after Open stays while its record waits,
  and Open again claims it once (`answerPullRequest.ts`).
- `PublishRunRow` draws a held plain push as well as a force push, with Push now
  after a declined plain push.

The scenes are `work-lead-push` and `work-lead-dependency`.

## Tests

- `permissions.test.ts`: each level, each precedence step, the stale pair.
- `leadPermissions.sqlite.test.ts`: writes, Use default, two windows, failure.
- `LeadDetailsDrawer/index.chip.test.tsx`: readers of one revision.
- `admission/admissionRows.sqlite.test.ts`,
  `level/admissionLevels.sqlite.test.ts`,
  `level/confirmationLifecycle.sqlite.test.ts`: admission per row, the level
  with no rows, confirmations.
- `asks.sqlite.test.ts`, `auto-grants.test.ts`: double answers, other windows,
  superseded attempts, the crash before launch.
- `prompt.level.test.ts`, `store.auto-level-prompt.test.ts`: the level text and
  what a turn sends.
