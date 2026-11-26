# Concepts

> **Read this when** you want to know what something in Goodboy is: a
> workspace, a project, a session, an agent and its kind, a workflow run, an
> artifact, a lens, a resolver, a permission rule, or how far an integration
> goes. **Not for** the code behind them ([architecture.md](architecture.md))
> or how a screen should look (`DESIGN.md`).

Goodboy is built from a handful of objects. This page says what each one is in
a few lines and points to the page in [concepts/](concepts/) that holds the
detail. The other docs link here instead of explaining them again.

## At a glance

- **Workspace**: where you work, named after what you work on
- **Folder**: one repository or plain folder inside a workspace (the code calls it a project)
- **Session**: one goal, the unit of work, with its own limit and shared notes
- **Agent**: one chat inside a session, with its own provider and model
- **Workflow**: a list of steps you can reuse, and each step gets its own agent; a run follows it as written or adapts it as it goes
- **Run**: one go at a goal inside a session, started as a workflow, an agent or the Lead
- **Plan**: the steps an agent writes before it builds, kept as an artifact you approve or revise
- **Lead**: the agent that picks how a run goes and starts helpers, under your limit (`auto` in code; on screen, Auto means only an automatic pick of a model or a folder)
- **Scout**: a role that reads the code and answers, and changes nothing
- **Artifact**: a plan, report or wireframe an agent saves as its own page
- **Lens**: one view of a session, such as its plans, questions or diff
- **Turn**: one message from you and one answer from the agent

The Guide's Words chapter mirrors this section in the app's voice.

## How they fit together

A workspace holds projects and sessions. A session holds agents, workflow
runs and artifacts. It only touches a project when the work needs it.

```text
workspace
├── profile, integration bindings, workflows
├── project (repo or folder)
│   └── scripts, settings override, binding override
└── session (one goal)
    ├── mounts: a worktree and branch per project it touches
    ├── agents: one or more chat threads
    ├── workflow runs: steps, each with its own agent
    ├── artifacts: plans, reports, wireframes
    └── activity: what happened, in order
```

A few rules are always true:

- A single repository is a workspace with one project
- A session belongs to the workspace, never to a project
- Every session starts with one agent, and always has at least one
- Git state is created or rewritten only when you ask: creating a project and
  its first commit, publishing it, moving the first lap into bootstrap, amend,
  squash, a resolve attempt. Never by a mount or a turn, and nothing is pushed
  without a publish

The app follows the life of a task: first the task, then the tools it comes
from and goes back to, then the code it produces, and the chat last.

## Map

- [workspaces.md](concepts/workspaces.md): creating, naming, switching or
  disconnecting a workspace, and a plain folder's face
- [sessions.md](concepts/sessions.md): a session's stage, the Needs you ranking,
  Done, the Overview and the Desk
- [lazy-sessions.md](concepts/lazy-sessions.md): when a session gets a worktree,
  mounts, Unmount, Cleanup and Storage
- [activity.md](concepts/activity.md): the Activity and Log feeds, the Needs you
  block and history rows
- [next-steps.md](concepts/next-steps.md): suggestion kinds, ranking, dismiss and
  undo, the failing check chain
- [agents.md](concepts/agents.md): an agent's life, the queue, the Lead, agent
  kinds and open questions
- [artifacts.md](concepts/artifacts.md): plans, parts and waves, plan comments,
  wireframes and versions
- [shared-context.md](concepts/shared-context.md): the session record, lenses,
  turns and Ask
- [review-comments.md](concepts/review-comments.md): notes, review
  conversations, comment words, git state and comment verbs
- [fix-runs.md](concepts/fix-runs.md): how a fix run starts, retries and pushes,
  and how a reply reads
- [settings.md](concepts/settings.md): setting levels and saves, the workspace
  profile, the editor and Open with
- [permissions.md](concepts/permissions.md): permission rules and how an ask is
  answered
- [integrations.md](concepts/integrations.md): bindings, what each tool can do,
  routing an item, the tracker after a merge
- [tasks.md](concepts/tasks.md): the Tasks list, its filters, record links and
  the project Start mounts
- [spend.md](concepts/spend.md): provider routing, spend figures and limits,
  what Impact keeps
- [vocabulary.md](concepts/vocabulary.md): words and labels on screen, and the
  guards that check them
- [identifiers.md](concepts/identifiers.md): code names of stages, reasons and
  kinds, and where each concept lives

## Sessions

A **session** holds one goal. Goodboy derives its stage on every read, and the
stages are the columns of the board: **building**, **running**, **needs you**,
**in review** and **done**. "Running" means an agent turn starting or running,
an agent waiting for a permission, or a workflow run deciding its next step.

Each state word means what this table says. The regression guard checks its own
copy of the meanings and the state maps against it.

| State word       | Meaning                                                       |
| ---------------- | ------------------------------------------------------------- |
| Needs you        | Only you can move it. The sentence says what it needs.        |
| Needs approval   | A plan waits for your approval. Counts as Needs you.          |
| Needs permission | A tool waits for your permission. Counts as Needs you.        |
| Not finished     | A step stopped before its work was done. Counts as Needs you. |
| Running          | Work is happening now.                                        |
| Queued           | Starts by itself when its turn comes.                         |
| Ready            | Starts when you say so.                                       |
| Paused           | Held on purpose, or at a limit. Nothing new starts.           |
| Failed           | Ended on an error.                                            |
| Stopping         | Stopping is in progress. What it wrote is kept.               |
| Stopped          | You or a restart ended it. What it wrote is kept.             |
| Done             | Finished its work.                                            |
| Idle             | Nothing happening. Write to continue.                         |
| Not started      | Ended and never ran.                                          |
| Skipped          | Nothing ran for this step.                                    |
| Closed           | You closed a failed agent out.                                |

Needs you counts three units, and each tooltip names its own: sessions ("2
sessions need you") on the Board door, the dock badge and Search or run; questions ("3 questions") on the Questions tab of the session;
items ("4 items need you") on the Overview card and the Runs group. The bell is
unchanged. `needsYouText` and `countNoun` write every one of them.

[concepts/sessions.md](concepts/sessions.md) has the ranking, Done and the
faces of a session.

## Lazy sessions

A new session starts with no folder, no worktree and no branch. A repo project
joins it only when the work needs it, as a **mount**: a git worktree with its
own branch. [concepts/lazy-sessions.md](concepts/lazy-sessions.md) has the four
triggers, mounts and Storage.

## Next steps

One engine, `deriveNextSteps`, decides everything the app suggests next, and a
suggestion is a move with a reason. [concepts/next-steps.md](concepts/next-steps.md)
has the kinds, per-branch gating and dismissal.

## Agents

An **agent** is a separate chat inside a session. **Close** is only for an agent
outside a workflow that is stuck on a failed turn or on its own question; a
workflow step never has Close. [concepts/agents.md](concepts/agents.md) has the
queue, the Lead, the kinds and open questions.

## Workflows

A **workflow** is a list of steps you can reuse, and each attach starts a
separate run. [workflows.md](workflows.md) explains how a run starts and moves
from step to step.

## Vocabulary rules

Each word has one meaning and each intention one verb. The verb tables, the
internal words that stay in code and their guards are in
[concepts/vocabulary.md](concepts/vocabulary.md).
