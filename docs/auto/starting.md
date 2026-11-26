# Starting a Lead

> **Read this when** you change how a Lead run starts: the **Start a run**
> field, moving a hand started agent to the Lead, a rebase handed to the Lead,
> or what a start stores for the run. **Not for** the limit a start picks
> ([limits.md](limits.md)) or the messages that follow the start
> ([messages.md](messages.md)).

## Start a run

The **Start a run** field is the one door: the New menu, ⌘K, the Runs page and
the New session page all open it. Each Auto conversation is a row of the
session's **Runs** page (`sessionRunsOf`), which opens it in the Auto chat.

- `StartRun` starts Auto when its router picks one agent (rows 4 to 6 of
  `runRouteOf`, see [Start a run](../features/start.md#start-a-run)):
  `spawnAgent` with the `auto` kind and the ask as first message. A role named
  with `@` starts at once, with no Auto turn first. The route is kept per agent
  in `runs.routes.<sessionId>`.
- There is no role list, project field or guidance. Auto picks the mount and asks
  when it is ambiguous. With no folder attached it still delegates a writer: the
  delivery says "MOUNTS: none attached yet" and the app attaches the project the
  task names or asks ([projects.md](projects.md)).
- The field carries the run's **Limit** chip ([limits.md](limits.md)). A start
  never rereads a setting at the click, so the form on screen is what starts.
- Auto runs on a connected provider that can confine a read-only agent, with the
  workspace's route for the role ([providers.md](providers.md)).

The goal is not a plain turn. The tree is created at the start and the goal is
queued in its outbox, so Auto's first turn is a delivery like every later one. A
start that loses the message says "The Lead didn't start" and keeps no
half-started turn.

A Next card that starts a role ends its more menu with **Discuss with the Lead**
(`suggestion.talkWithAuto`, `features/actions/kinds/suggestion.ts`): it opens
**Start a run** with the card as text (`startTalkItThrough`) and starts nothing.
**Generalist** keeps its name and its agents; Auto is never in the manual role
list.

## What a start stores

`spawnAgent` writes three workspace values, each a map of the root agent id to
its entry, with a compare and swap: `run.guidance` before the first turn,
`run.limit` and `run.locks` before the agent row exists.

| Value          | Folder                       | Holds                                                                  |
| -------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `run.guidance` | `store/runtime/runGuidance/` | The run's guidance                                                     |
| `run.limit`    | `store/runtime/runLimit/`    | This Lead's limit ([limits.md](limits.md#a-limit-picked-for-one-lead)) |
| `run.locks`    | `store/runtime/runLocks/`    | A preset Lead's pinned steps: each step's role and lock                |

`buildTurnSpawn` passes the agent id to `autoSystemPromptOf`, so
`buildAutoSystemPrompt` adds **GUIDANCE FOR THIS RUN** to every turn, and
`resolveDelegateChild` puts it in each child brief as `**Guidance**` before the
`**Task**`. A run without guidance gets neither.

When the Lead delegates, `resolveDelegateChild` hands the lock of the first step
whose role matches the child to the routing as `stepLock`, so the child runs on
the pinned provider, model and effort whatever the Lead proposed. The brief names
the pin.

## Moving an agent to Auto

**Let the Lead take it from here** hands an agent you started to Auto. It shows
on old rows only: an agent **Start a run** started keeps a route and never offers
it. It is on Implementer, Tester, Scout, Planner, Reviewer, Debugger, docs and
old Generalist agents, through the registry verbs `agent.moveToAuto` and
`agent.detachFromAuto` (`features/actions/kinds/agent.ts`), and is blocked with
"Wait for the turn to end first." while the agent works.

1. The verb replaces the agent's composer with **What should the Lead do next?**
   (`MoveToAutoPanel`); the field may stay empty. A handoff marker with
   `kind=auto` shows the same panel from the chip **Agent suggests: the Lead**.
2. `moveToAuto` (`features/auto/moveToAuto.ts`) checks the release gate.
3. `adoptAgent` (`store/runtime/auto/adoptAgent.ts`) writes the whole transfer in
   one guarded transaction: a new Auto agent and tree (in `merging`), one settled
   adopted delegation for the source (`adopted = 1`), its plan and report
   artifacts in `auto_artifacts`, and one `user` outbox row with the kickoff
   (`composeAdoptionKickoff`: the ask, the last reply, the artifacts, the mount,
   your words).
4. `moveToAuto` drives the tree through `autoDrivePort` at once. A window with no
   runtime leaves it to the main window's tick.

The transaction refuses, writing nothing: an agent with a delegation row or a
tree (a second click returns the first Auto), a step of a Run ("Pause or finish
the run first."), a running turn, a kind with no role, and any agent whose
parent or child chain holds an Auto agent.

The source keeps its row and chat; its composer becomes **Moved to the Lead**
(`AdoptedNotice`) with **Open the Lead** and **Detach from the Lead**, and inside
a tree the Continue buttons and handoff chip hide. **Detach from the Lead**
(`detachAdopted`, also in the move's toast) waits for the turn to end, removes
the adopted delegation, its artifacts and the unread words about it, and bumps
the tree revision. The Auto agent stays.

## Rebase conflicts

A rebase on main is plain git and never starts Auto. On a conflict or a commit
hook it keeps `rebaseConflict` (the onto ref, the base, the head before) and the
files (`store/slices/history/rebaseBranch.ts`), and asks the person.

**Start new Lead** (`mount.resolveRebaseWithAuto`) calls `resolveRebaseWithAuto`
(`store/slices/rebaseAll/resolveRebaseWithAuto.ts`): one Auto agent through
`spawnAgent` with `kindOverride: 'auto'` and the workspace route, its goal through
the user turn port (over the bridge from another window). `rebaseAutoGoal` names
each branch, worktree, onto ref and conflicted file, and tells Auto to hand each
branch to one writer in that worktree, ask only on an ambiguous conflict, run
`git rebase --abort` on a branch it cannot finish, and never push. **Add a hint**
ends the goal.

- The run is marked handed (`autoAgentId`) only once Auto took the goal and the
  run is still the one asked, so an answer after **Abort rebase** changes nothing.
- **Rebase all** (`store/slices/rebaseAll/rebaseAll.ts`) rebases with git first
  and hands every conflicted branch to one Auto run. `shouldTidy` would add a
  local tidy list, but every caller (`session.rebaseAll`, `updateAll`) passes
  `false`.
- With no provider that can run Auto, **Start new Lead** says why
  (`autoUnavailableReason`).
