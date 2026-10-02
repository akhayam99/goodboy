# Concepts

> **Read this when** you want to know what something in Goodboy is: a
> workspace, a project, a session, an agent and its kind, a workflow run, an
> artifact, a lens, a resolver, a permission rule, or how far an integration
> goes. **Not for** the code behind them ([architecture.md](architecture.md))
> or how a screen should look (`DESIGN.md`).

Goodboy is built from a handful of objects. This page says what each one is.
The other docs link here instead of explaining them again.

## At a glance

- **Workspace**: where you work, named after what you work on
- **Project**: one repository or folder inside a workspace
- **Session**: one task, with its own goal, budget and shared notes
- **Agent**: one chat inside a session, with its own provider and model
- **Workflow**: a list of steps you can reuse, and each step gets its own agent
- **Artifact**: a plan, report or wireframe an agent saves as its own page
- **Lens**: one view of a session, such as its plans, questions or diff
- **Turn**: one message from you and one answer from the agent

## How they fit together

A workspace holds projects and sessions. A session holds agents, workflow
runs and artifacts. It only touches a project when the work needs it.

```text
workspace
├── profile, integration bindings, workflows, skills
├── project (repo or folder)
│   └── scripts, settings override, binding override
└── session (one task)
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

The app follows the life of a task. First the task itself. Then the tools it
comes from and goes back to. Then the code it produces. The chat comes last.

## Workspaces and projects

A **workspace** is named after what you work on, not after a folder on disk.
It holds your profile, your connected tools, one or more projects and every
session.

A **project** is one place where code or files live. It has a root folder on
disk, and it is one of two kinds:

- A git repository, kind `repo`
- A plain folder, kind `folder`

Each project belongs to one workspace only. It keeps only what is specific to
that place. That means its scripts, its own settings and, if you want, its own
connection to a tool.

The new-workspace form offers **Start from a project** and **A workspace with
several projects**, and the empty screen adds **Start a new project**. They set
up the projects of one workspace. They are not different kinds of workspace, and
a workspace never links to another one
([ADR 001](adr/001-workspace-project-rename.md)).

You can **star** the projects you work on most and give each project a
one-line **description**. Both live on the project row in workspace settings.

- Every agent's project list puts starred projects first, marks them, shows each
  description next to the name, and says to look in starred projects first when
  a request names no project. The planner and the orchestrator get the same list
- Project pickers and the Activity project filter put starred projects on top
- A star never changes what an agent may mount or write

A repo project needs a working git setup before a session can make a worktree
in it.

**One workspace per window.** Switching a window to another workspace cancels
every turn running in the one it had, so opening a workspace only switches
this window in place when nothing is running here. When agents are running,
the workspace popover asks first and offers a new window, which keeps them
going; a side door that used to switch silently (a notification, an inbox
item, Add workspace) now opens that workspace's own window instead of
touching this one. `⌘Enter` on a workspace row always opens a new window,
no question asked.

**Disconnect** keeps a workspace and its projects in the database with
everything they hold, it only hides them. Re-adding the same folder through
Add workspace, or a project through Add project, reconnects it and its
sessions instead of creating a duplicate. If the folder moved since it was
disconnected, Goodboy recognizes it by repository identity and offers to
locate it the same way a moved project is located while connected.

Moving a project's folder on disk does not lose anything either: the
database keeps its rows, but every saved path still points at the old
location, so the project reads `Folder not found` until you **locate** it
(pick the new folder, or its parent to locate several at once). See
[architecture.md](architecture.md#moving-a-projects-folder).

## Sessions

A **session** holds one goal. It has its own budget and notes
that every agent in it can read. "Refactor authentication domain" is a session.

You never set a session's stage by hand. Goodboy works it out from what is in
the session. The stages are the columns of the board:

- **building**
- **running**
- **needs you**
- **in review**
- **done**

"Running" has one meaning everywhere. An agent turn that is starting or
running, an agent waiting for an approval, and a workflow run deciding its next
step all count as live work. The top bar chip, the workspace switcher's "N
running", the footer count, the update pill and the restart-when-idle check all
read it, so a workspace with one agent waiting on a permission is never "idle".

The board looks at the pull request or merge request of every mount, GitHub,
GitLab or Bitbucket, and takes the worst one: failing CI, then changes
requested, then approved. A session is done only when every request is merged
or closed.

### Session lifecycle

What you did in a session stays counted after the session leaves the board.
Impact, the Spend tab and the spend chip in the top bar all count it.

| How it goes away                      | What happens to its rows                                                                          | What Impact keeps                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| You delete it in Goodboy              | transcript, file versions, slots, decisions and images are freed; the row stays with `deleted_at` | sessions, spend, pull requests, reviews and durations |
| Its worktree disappears from disk     | rows stay, the mount is marked `missing`                                                          | everything                                            |
| You archive it                        | rows stay with `archived_at`                                                                      | everything                                            |
| You detach or forget its project      | the mount row and its pull request links go                                                       | merged pull requests, through their `pr_merged` event |
| You remove its workspace              | rows stay, the workspace is disconnected                                                          | everything, under that workspace                      |
| A draft that never started is deleted | the row goes                                                                                      | nothing to keep                                       |

A deleted session shows up in Impact with a **Deleted** label and does not
open. Its spend joins the live spend in one sum: the store reads the archived
and deleted part once when the workspace opens (`dormantSpend`) and adds the
live sessions on top.

## Lazy sessions

A new session starts with no folder, no worktree and no branch. A turn that
runs before anything is mounted writes to a scratch folder,
`~/.goodboy/scratch/<session-id>`.

A project joins the session when Goodboy **materializes** it. That means it
gets its own working copy inside the session, called a **mount**:

- A repo project gets a git worktree under the repository's own
  `.goodboy/worktrees/`
- A folder project gets a plain folder under `<project-root>/sessions/`

[mounts.md](mounts.md) owns the layout and the mount lifecycle.

This only happens when the work needs it. There are four ways:

1. A workflow step that writes files reads the run goal, the step prompt and
   the plan it follows. Every project named there is materialized before the
   step starts. This is how a planner says which projects the work touches.
2. You press the **+ project** chip in the session's scope bar.
3. An agent asks for it through the [query bridge](query-bridge.md).
4. In a workspace with exactly one project, the first turn materializes that
   project.

Each of these needs a reason, and the reason is saved in the session's
activity. If the reason is blank, Goodboy refuses before doing anything.

A project made with **Start a new project** is the exception while it has not
been published. Its first lap session works in the project folder on `main`
and none of the four triggers cuts a worktree, because the repository's only
commit holds `.gitignore` and the worktree would be empty. Once `main` is on a
code host, the work left in the folder moves into a session named `bootstrap`
and every later session is an ordinary worktree ([mounts.md](mounts.md) → The
first lap and the bootstrap move).

The branch is named `<prefix>/<session-slug>`. It has the same name in every
project the session touches. The repository name on each mount tells them
apart.

Before a project is materialized, agents can read its root folder. Every write
has to go into the scratch folder or into a mounted project.

### Mounts

One repository can have several mounts in the same session. Each mount has
its own worktree, its own current branch and its own pull request history.

- **Switch** moves one mount to another branch
- **Fork** makes a new mount from a base you pick, and leaves the original
  one as it was
- If you run `git checkout` by hand inside a mount, Goodboy marks it as a
  mismatch. It waits for you to pick switch or fork, because the checkout
  alone does not say what you wanted.

**Unmount** takes one mount out of the session and keeps its history. The
screen calls it **Close worktree**, and a closed row offers **Reopen**.
**Cleanup** deletes the worktree and keeps its local branch. Goodboy does not
delete a mount that has uncommitted work, a lock, or a process still using the
folder. It keeps track of it and tries again at the next cleanup.

**Storage** (Settings > App > Storage) shows every worktree folder Goodboy made
in three groups. **In use** belongs to a session that is still open and is never
touched from there. **To review** belongs to an archived or deleted session, or
to no session at all. **Kept** is what you chose to keep, for good or for 30
days. A clean folder idle longer than "Suggest cleanup after" (30 days by
default) can go in one bulk step. Its branch stays, even with commits that were
never pushed. A scope picker filters all of this to one workspace, to
**Removed workspaces** (folders whose owning workspace is gone or never had
one), or to **All workspaces** (the machine total); it defaults to the
current window's workspace.

Storage also lists **artifacts from deleted sessions**: the plans, reports and
wireframes whose session is gone, with their saved copy on disk. Each row says
when its session was deleted and when you last used it, which is the later of
its last edit and the last time you opened it. You can open one, keep it for 30
days or always, or delete it. Deleting removes both the copy and the record. An
artifact whose session was deleted longer ago than "Suggest cleanup after" and
that you have not used for twice that long is suggested for one bulk delete.

The **Overview** groups mounts of the same project together. Each row has its
own terminal, diff and pull request links.

A turn **starts in** one mount: that is where it opens its terminal, runs git
and shows its pull request. It can still write in every mount of the session.
The chat header names the start ("Starts in") and lists the rest of the reach
in its tooltip. With two or more mounts, you pick where new turns start there
or from a row's menu, and each row shows the agents working in it right now.
Once a turn ends, Goodboy records which mounts it changed, so an agent's row in
Activity names every worktree it changed, not only the one it started in.

## Activity

A session keeps a list of everything that happened to it, in order. The
**Activity** timeline shows that list grouped by day. You can read the session
back like a story of the work, without scrolling through chats.

It includes:

- The container and branches being created
- Issues linked and unlinked
- One pull request per project, from opened to merged or closed
- Workflow runs started, closed and discarded
- Changes to the decisions
- Projects materialized, with their reason, and refused ones, with the error
- Tasks created in other tools from Goodboy
- History outcomes of Rewrite history and Rebase on main: `history_rewritten`,
  `history_pushed`, `history_stopped` and `history_restored`

History rows are the only event rows with verbs, one primary and the rest in
the row menu, and only while no later outcome of the same branch settled
them: a rewrite offers `Undo rewrite`, a stopped one `Retry` (or `Retry with
a note` when History rewriter needs you) with `Rewrite with an agent`,
`Change the plan` and `Discard plan` behind it, a push `Restore previous
history`. A stopped rewrite never hides behind the filter. Every notification
of the engine points at the row with `Open in Activity`, so closing it loses
nothing.

Every event has a reason. If an action cannot say why it happened, Goodboy
refuses it instead of saving a blank entry.

The header shows a neutral needs-you chip ("2 need you") only when no row
that waits on you is on screen, because the filter hides it. It counts each open question once, the same number the Questions
chip shows, and one per other ask, and a click switches to Needs you. **Filter** opens one panel with every kind of row at once, in three
groups: Work (agents, workflows, questions, resolvers), Outputs (artifacts
with plans, reports and wireframes, pull requests, issues) and Session log
(branches and worktrees, decisions, session events). Each row shows how many
of its kind the session holds, and how many of those rows the filter is
hiding when the toggle is off. Presets set the whole
filter in one click: **Everything**, **Work**, and **Needs you**, which shows
only what waits on you whatever the filter hides and lasts until you leave
it. A saved filter that matches the old Work preset migrates onto the new
one, resolvers included. The trigger counts hidden rows, not hidden kinds
("Work · 12 hidden"), and flashes briefly when a new row lands out of sight.
A row your own action just caused (starting an agent, a resolve, a workflow,
or acting on a suggestion) never hides behind the active filter: it stays
visible, tagged "Shown because you started it", until you leave the session;
the next visit it follows the filter like every other row. The filter shows
once the feed holds more than one kind of row. **Start agent** is the one
primary, and its menu starts a workflow, a report or a wireframe. When the
activity column is narrower than 28rem, the needs-you chip keeps its count
and Filter keeps its icon. Suggestions live in **Next steps**, above Activity
and outside its filter, not as a row inside the feed.

An open question shows once on screen, on the agent that asked it. Its
question row, on that agent's lane, carries the text and the one **Answer**,
all neutral: the waiting agent row is the one amber mark in the activity. The
agent row keeps its "Needs you" state without a second button, and takes
the Answer back when the filter hides question rows. The workflow row says
nothing about a question its step or the question row already shows: no
sentence, no Answer, only a neutral "Waiting on a step" node. It names the
question only when neither is in view (a sub-agent and question rows both
filtered out), and then its Answer opens the asking agent at the question.
The activity reports which open questions its rows show (`shownQuestionIds`),
so Next steps and the needs-you callout above it do not repeat them. The
needs-you count counts each family once, so one question never counts twice.

## Next steps

One engine, `deriveNextSteps` (`features/suggestions/`), decides everything
the app suggests doing next. It owns the concept: nothing else derives a
suggestion, and every surface that shows one calls the same
`useSuggestionActions` resolver, so clicking "Continue" does the same thing
whether you clicked it on the board or in the session overview.

- **`NextStepSlot`** (`features/suggestions/components/NextStepSlot/`) sits
  in the session overview, above Activity, outside its filter and its
  grouping: a suggestion is not activity, it is a pointer to what activity
  should happen next. A new session shows the kickoff instead; the two never
  compete for the same moment.
- Every suggestion carries a **band** (0 waits on you, 1 unblocks something,
  2 ships something, 3 improves something), a **why** (the second line, the
  concrete reason), a **fingerprint** (kind, object, trigger version) and a
  **target key** (the object it is about, when it has one). One winning
  suggestion per target key survives per render: `dedupeByTargetKey` keeps
  whichever has the lower band number.
- A suggestion you acted on does not come back for the same fingerprint;
  "Not now" is scoped the same way, and both persist for good: the
  fingerprint rides along in the same `next:<kind>` row's `contextJson`
  (`dismissedFingerprintsFromEvents`, `nextStepOutcomes.ts`), read back with
  no time bound, so a reload or a remount does not resurrect what you just
  dismissed or acted on. It returns only if the trigger changes and the
  fingerprint with it (new commits, new red CI, a new plan). Three "Not
  now" on the same kind inside a session in 14 days, with no acceptance
  between them, moves that kind behind everything else instead of leading
  (`shouldDemote`, `nextStepGates.ts`): the only learning this engine does,
  and it resets the moment one of that kind is accepted. Every act or
  dismiss writes a `next:<kind>` row to `nudge_events`
  (`useNextStepOutcomes`); the demotion window reads the session's own
  history, not the workspace's.
- The answer-open-questions suggestion counts only the open questions the
  Activity does not show, so it never sits above a question already in view.
  With one such question, **Answer** opens the agent that asked at that
  question (`useOpenAgentQuestion`); with more, it opens the questions view.
- An approval has one place in the overview: the **Needs you** callout,
  whose **Answer the approval** opens the blocked agent. The approve-tool
  suggestion for that same agent stays out of Next steps; an approval the
  callout does not name (a second blocked agent) still shows there.
- Eighteen suggestion kinds ship: the original six (answer open questions,
  continue a workflow's ready step, fix review conversations, rebase a
  project, run a ready plan, add a proposed project) plus twelve more that
  landed on the same engine, not a second one: approve a pending permission,
  sign back in after `auth_required`, resume every agent a restart stopped
  (one **Resume all**, band 0, standalone and workflow agents alike), retry
  the last standalone agent that failed, fix a pull request's failing checks,
  push unpushed commits on a clean worktree (counted against the branch's
  own copy on origin by `branchPushStateOf`; `Push the branch` with `Not
pushed yet` when origin has no copy, and `Branch diverged from origin`
  with `Review history` instead of a push when origin moved on its own),
  open a pull request once a
  mount is ahead with none yet, mark a green draft ready, merge an approved
  and green pull request, review the changes once a standalone implementer
  finishes clean, close a merged worktree's cleanup proposal, and continue
  with a workflow once a standalone scout or generic agent finishes clean
  with a goal set and no workflow attached yet (a discarded run does not
  count as attached, so the offer comes back) - its "Set up" action attaches
  the workspace's first library workflow with the session's own goal in one
  click, no form. Merge and close-worktree arm a
  confirm on the row before they act; the other new kinds run on one click,
  like the original six. Push, open-pr, mark-ready and merge-pr act on the
  mount their suggestion names (`markPrReady` and `mergePr` take a
  `mountId`), never the session's active mount. Two simplifications from the design: the "never
  while an agent works on the same mount" rule (E7-6) is session-wide, not
  per-mount, for the new push/open-pr/mark-ready/merge-pr/fix-checks kinds
  only - rebase-project keeps its own narrower per-request check; and the
  demotion window (above) reads the session, not the workspace. A failed
  workflow step has no suggestion: its own row in Activity carries the one
  **Restart the step**, which opens the step where Check completion and Skip
  step live. approve-tool opens the agent's
  chat rather than the permission card directly; sign-in dispatches the
  same `goodboy:open-settings` event the palette's "Connect a provider"
  uses. continue-with-workflow always offers the workspace's first library
  workflow, not a goal-aware recommendation - `recommendPreset.ts` (design's
  name for that ranking) was not built, since nothing else in this pass
  needed it.
- The board card's "Continue" and the Next surface's primary action for a
  ready workflow step both call `activateWorkflowAgent` on the same pending
  agent; neither one just opens a panel and leaves starting the step to you.
- Accepting plan-ready announces the started implementer with the same
  `useAgentStartedToast` every other spawn-and-open flow uses ("Implementer
  started", with an "Open the agent" action) - the toast the standalone
  PlanReadySuggestion component used to show before the unified resolver
  replaced it in E7-5, restored here.

## Agents

An **agent** is a separate chat inside a session. Start as many as you want,
switch between them with a click and rename them in place.

Each agent has its own provider, model, effort, verbosity and kind.

You do not need a workflow to start an agent. When you attach a workflow,
Goodboy starts one agent per step. Those agents sit next to any you added
yourself.

**Start agent** asks only for a role and its routing. The button says what
happens next: an Implementer with an active plan starts on that plan right
away, and every other role opens its chat with the cursor in the composer so
you write the first message. Until you do, its row reads "Waiting for your
first message" and does not count as needing you.

An agent finishes on its own. Once its last turn succeeded, it has no open
question of its own, no turn is starting or running and no child still works,
it moves to the finished agents without a click. Sending it a new message
opens it again. There is no "mark done".

Writing to an agent while its turn runs offers two choices, the same two the
orchestrator hints use. **Queue** (Enter) waits for the turn to end. **Send
now** (⌘Enter) stops the turn, keeps what it wrote, and continues with your
message. Queued messages sit above the composer, reading **Waits for this
turn** or **Sending now**, and each one can be edited, removed or sent now.
They are saved in the database (`agent_queued_messages`), so they survive a
restart, and they go out one per turn in order. An agent you stopped keeps its
queue until you continue it or send one now. Once sent, a message leaves the
queue and its bubble in the chat says "Queued · sent after the turn" or "Sent
now · interrupted the turn".

**Close** is only for an agent outside a workflow that is stuck on a failed
turn or on its own question. It means "stop waiting on this agent": the agent
reads "Closed by you" with a neutral check, not a success, and **Reopen** takes
it back. A workflow step never has Close. A stuck step is unblocked with Skip
step in its next action, because closing it would leave the run blocked with
no instruction. `isAgentFinished` and `isAgentClosable` in
`apps/desktop/src/features/session/agent-lifecycle.ts` hold both rules.

### Agent kinds

The **kind** decides how an agent works: what it may change and what it gives
back. Each kind comes with a default model, an effort and, sometimes, its own
system prompt.

Goodboy guesses the kind from the agent's name or first message. You can also
pick it when you start the agent.

- **Plan**, **Scout**, **Implement**, **Debug**, **Test**, **Review**,
  **Docs** and **Generalist** are in the menu for new agents
- **Report** and **Wireframe** run as workflow steps
- **PR reviewer** opens a session that reviews someone else's pull request
- **Resolve** starts from the **Review** lens and fixes review comments
- **History rewriter** is hidden: nobody picks it. Goodboy starts it only
  when replaying a branch history hits a conflict git cannot settle alone
  (a rebase on main, or a Rewrite history plan). It works in a throwaway
  copy of the branch, never in a mount. Its turn carries a git config that
  points `origin` at a push URL that always fails, it has no GitHub token and
  no bridge mount. It reports with `<<history-step>>`, `<<history-done>>` or
  `<<history-stuck>>`; the engine rebuilds its commits with the plan messages
  and authors, checks the count, and moves the branch itself
- **Scribe** is hidden too: it writes text about the code and never code.
  `Write it for me` in the pull request panel asks it for the title and
  body, which fill the form for you to check before `Create PR`; it can also
  write a commit message for a squash or a reword and a changelog entry. It
  answers only with `<<pr-title>>`, `<<pr-body>>`, `<<commit-message>>` and
  `<<changelog-entry>>` blocks, runs with push blocked like History rewriter,
  and Goodboy opens or edits the pull request itself. A body Scribe wrote
  ends with an invisible `goodboy-scribe` signature; after Goodboy pushes new
  history to the branch it rewrites the body only while that signature still
  matches, so a body you edited stays yours

A kind is worked out in the same order on every screen:

- A started agent (`classifyAgent`): the kind override, then the saved kind
  (old role names such as `investigator` map to their kind), then the agent
  name
- A workflow step (`classifyStep`): the step role, then the step name
- An agent not saved yet (`resolveAgentKind`): the override, then the name,
  then the first user message

Only those three functions guess from a name, so no screen can pick a kind its
own way. `AGENT_KIND_META` in `apps/desktop/src/features/session/agent-kind.ts`
lists every kind, and `visibleAgentKinds` decides which ones the menu offers.

The code name behind each label is in [Under the hood](#under-the-hood).

## Workflows

A **workflow** is a list of steps you can reuse. Attach a ready one from the
sidebar or build your own. It can have a goal, and you can change that goal for
each run.

- **Each run is separate.** Attaching a workflow starts a run. The same
  workflow can run many times in one session, and each run stands alone.
- **You pick when a run starts.** It can start when you attach it (the
  default), when you press start, or after another run finishes. A run that
  waits for another one starts by itself when that one is done.
- **Drafts stay while you move around.** A workflow you are building stays
  when you switch sessions. It goes away when you create it or throw it away.
- **Describe it in words.** Goodboy turns your description into draft steps.
  You edit them before attaching.

[Workflows](workflows.md) explains how a run moves from step to step.

## Open questions

An open question is something an agent cannot decide for you. It has the
question, suggested answers, an optional recommended answer, and whether one
or several answers apply.

- **Blocking or not.** A blocking question stops the work that asked it. It
  holds its workflow run (see [workflows.md](workflows.md)) and can only be
  answered, never dismissed. A non-blocking question can be dismissed. One
  asked while an agent drafts an artifact is saved in the artifact's history
  as an assumption, with the recommended answer.
- **Delegated.** You can hand a question to an agent that answers for you,
  with optional hints and a model. Its answer counts as yours, and the asking
  agent is told an agent gave it. A delegate that answers nothing is nudged
  once, then fails. Answering it yourself, or taking it back, stops the
  delegate. A question a delegate asked is never delegated again.
- **Staged, saved, then delivered.** Answering a question stages it, with
  Undo, while the same agent still has another question waiting on you. Once
  its last one is answered, every staged answer of that agent is saved at
  once. It reaches the asking agent only when that agent has no open question
  left (one handed to a delegate still counts). Then all its answers travel in
  one turn and are marked delivered. Answered and delivered are two different
  facts.

## Artifacts

When an agent writes a **plan**, a **report** or a **wireframe**, Goodboy saves
it in the session as an artifact, with its own page. It does not stay buried in
the chat.

An artifact has a status:

- **active**: waiting for the next agent
- **consumed**: an agent has used it
- **superseded**: a newer version replaced it
- **discarded**: taken out of the session

### Open questions

Planner agents write plans. Other agents use them, and Goodboy remembers who
used which plan. The Artifacts page lists plans, reports and wireframes as one
list, newest first, and opens each of them in the same page: a small header
with at most one main action, the document at reading size, and a right panel
for its details and for a chat with the agent that wrote it. **Open in
browser** opens the file Goodboy keeps on disk with the system's default web
browser, never with an editor; from there `⌘P` prints and the system saves
the PDF. Goodboy also keeps a copy of every artifact on disk, under the
workspace folder described in
[architecture.md](architecture.md#on-disk-data-layout): the Details panel
shows its path under **File**, with **Open in browser** and **Show in
Finder** next to it. The lens's `⋯` also has **Open artifacts folder**, for
the whole workspace folder at once. Every write to a plan, report or
wireframe keeps its own row in `artifact_revisions`
([architecture.md](architecture.md#on-disk-data-layout)): the Details panel
lists them newest first once there is more than one, names who wrote each
(the agent, by name, or "You"), and **Restore** on an older one writes it
back as a new revision, never over the history; the current row carries no
Restore button. The wireframe viewer's own version pill and its node-level
diff are a richer view of the same table, not a second one.

The planner splits a plan into **parts** (the `clusters` of the plan). The plan
page lists them after its goal, says who split them, and shows for each one its
checks, the files it touches and its model (`Auto` when the planner proposed
none). Once the plan runs, each part takes the state of the subagent that
carries it, matched by order under the agent that ran the plan.

A plan follows one shape: a title, then Goal, Context, Approach, Risks, Done
when and Out of scope. The planner writes each part with its own checks
(`doneWhen`, at most 4) and the files it touches (`touches`, at most 12), and
the subagent that carries a part receives both in its kickoff, so it knows
when the part is done.

A wireframe opens on its **Flow**: the graph of its screens, a one line legend
(`next`, `back`, `same screen`, told apart by line style and glyph, never by
colour) and the screens as a grid of page previews under it. A node or a tile
opens **Screens**: the screens on a rail, the real page of the open screen in
the middle, inside the frame of its device, with a Fit or 100% zoom, and a
**Notes** panel with the screen note, the numbered notes of its nodes (a click
shows the node on the page) and where the screen goes. The pages are the same
ones the saved copy holds, shown in an isolated frame
([architecture.md](architecture.md#frames)); links inside them work, and the
rail follows. **Open in browser** opens the screen you are looking at, or the
index on the Flow, from the saved copy. Under `⋯`, **Copy spec** copies the
JSON and **Save a copy to…** writes, into a
folder you pick, `index.html` with the flow and the screens, one page per
screen under `screens/` linked by plain links, one `wireframe.css`, the
validated `wireframe.json`, its `wireframe.schema.json` (built from the code
constants by `buildWireframeJsonSchema`), a `README.md` with a prompt to
rebuild it elsewhere, and `meta.json`. The pages hold no script and no inline
style. Goodboy never reads that folder back.

The wireframe spec is version 2. It can define **patterns** once and reuse
them (`{ "use": "posting-row", "with": { ... } }`), give a screen up to 4
**states** (empty, loading, error or a name of its own, each a set of nodes to
hide, show or retext), cut the same flow into release **variants** with
`only`, set the **device** (desktop, tablet or phone), and use the kinds card,
tabs, badge, toggle, sheet and chart. A note on a node becomes a numbered
marker on the page. A version 1 spec is upgraded when it is read: its
`mockState` toggles become states. Every revision is kept in
`artifact_revisions` (who made it, what was asked, the nodes picked), and the
saved copy holds one folder per version.

You change a wireframe from the **Screens** view, not from a chat. Under the
stage, **Ask for a change** takes a request; **Pick** outlines the element under
the pointer and turns a click into a chip, and the scope is **This screen** or
**All screens**. ⌘↵ sends the spec, the request, the picked node ids and the
scope to the agent that drew it. While it works, the version pill reads
`v4 · Drafting` and the stage stays on the current version. A version that
lands takes the request as its label; a spec that fails the checks is **not
kept**: a warning says why, the request stays, and **Ask again** resends it.
The version pill opens every version (who, when, what was asked and what
changed) with **View**, **Compare** and **Restore**. Viewing an older one says
so above the stage, and Restore writes it back as a new version, `Restored vN`,
so the history is never rewritten.

**Compare** lays two versions side by side on the same screen. The diff is
computed from the two specs by node id, never from the HTML: the rail marks
each screen Added, Changed, Removed or Same with a glyph and the word, the
newer page outlines added nodes with `+` and changed ones with a dashed `~`,
the older one outlines removed nodes with `−`, and the **Changes** list says
what moved in words. A click on a change shows the node in both pages. A node
that kept its kind, text and place under a new id counts as changed. When a
version lands, the notice offers `N changes · Compare` for 10 seconds; after
that Compare stays in the versions popover.

A spec made or edited outside comes back in. On the Artifacts page, **New ▾ >
Import wireframe JSON…** picks a file (or drop a `.json` on the page); inside a
wireframe, **Replace spec with JSON…** in the versions popover does the same
for that wireframe. The validator answers inline, never in a dialog: what it
adjusted, with **Import anyway** and **Cancel**, or why the file cannot be
read. An import gets an idle Wireframe agent that owns it, the same agent you
then ask for changes, and its version reads `Imported JSON`.

A plan also says which projects the work touches. When a step that writes
code starts, Goodboy materializes those projects.

## Shared context and lenses

Agents in the same session do **not** see each other's chats. What they share
is the **session record** on the **Overview**:

- The goal, the decisions and the summary, in that order, in the **Context**
  drawer (the overview keeps one `Goal` line under the title when the goal
  says more than the title). The summary reads as State, Next, Open questions and Learned, one
  block each, key line first.
- What the session produces, as sections of the same page: workflows, agents,
  review, questions, diff and plans

Goodboy updates the decisions and the summary when the summarizer runs after a
turn, and writes the goal when the session starts. You can edit all three
yourself too. Each decision keeps a number for the life of the session: agents
and the summarizer replace or withdraw it by that number, with a reason, and
one nobody names stays as it is. When a run finishes or a pull request merges,
Goodboy consolidates the decisions and the summary once more.

Each of those sections is a **lens**, a view of the session. You open it from
rows and chips on the **Overview**. It opens in place or in a side panel, and
text shows as formatted markdown.

Chat is one lens like the others. It is not the frame around them. When you
switch agents, the chat changes but the **Overview** stays the same. The
record belongs to the session, not to the agent. That is how separate agents
work on one goal without mixing up their chats.

A **turn** is one message from you and one answer from the agent, with
everything that streams in between.

## Pull request review

A **note** is a comment on a line of the diff that stays in Goodboy: yours, or
one an agent reviewer left. A note never publishes on its own.

A **review conversation** is Goodboy's saved record of one review, issue or
note. It keeps its state, its verdict, its draft reply and the commits that
answer it.

Review exists with or without a pull request. Without one, its header reads
`No pull request yet` with `Open a pull request`, and the list holds the notes.
With a pull request, the list mixes the GitHub threads and the notes. Every
open note gets a conversation, and deleting or resolving the note closes it. An
agent reviewer's comments on a branch without a pull request are kept as
notes. When a pull request arrives the notes stay notes; `Post open notes to
the PR` in the Review menu turns them into draft review comments, never on its
own.

A note goes through the same flow with the same resolver, but there is no
reply to write: without a pull request, `Accept` keeps the fix on the branch
and closes the note, and `Close the note` closes it without a change.
Reopening a closed note opens a new conversation generation instead of
reviving the closed one, so the resolved history stays next to the reopened
conversation.

Every open review thread on the pull request gets a conversation as soon as
Goodboy reads the pull request, even if no agent has touched it yet. Goodboy
reads every page of threads GitHub returns. If the read fails, Review
shows the error from `gh` instead of an empty list.

Review is one flow: the list on the left, the focused comment on the right.
Every comment shows one state word, grouped in three:

- **Open**: Not started, Drafting (one live line says what the agent does),
  Needs you (the agent asked), Ready (the fix and the reply under the comment,
  with an Edited tag once you changed the reply), Comment changed (the reviewer
  edited the original comment since the draft), Draft failed or Push failed (the box under the comment
  names the reason, such as the run ended before a result or the provider
  error, never a generic error. A failed run also shows the last command it
  ran with its result, such as `pnpm test src/webhooks · 2 failing`, and a
  link to the transcript)
- **Ready to push**: Accepted, Reply only (with a Resolve only tag when
  nothing is posted)
- **Done**: Skipped (it never blocks the push), Pushed, and Resolved on GitHub
  when someone else closed it

The state word carries the tone: Needs you is the only warning, Ready is neutral
(the Accept button is the signal), Edited and Comment changed have their own tones,
and the header shows one summary line instead of a chip per state. The `…`
above the list filters the list by state.

Review reads git after a fetch when it opens and again before every push, and
keeps one git state per thread in `resolve_threads.git_state` (`local`,
`on_origin`, `fixed_elsewhere`, `folded`, `missing`). A comment whose fix sha is
already on `origin/<branch>` reads **Already on origin**: it offers
`Reply and resolve`, the header Push does not count it (the header says how many
more need only a reply) and `preparePublication` pushes only the local threads.
A comment with no fix of ours whose commented line was changed by a commit on
origin that Goodboy did not make, or whose fix `git cherry` finds under another
sha, reads **Looks fixed**: it shows the commit and its author, `Reply and
resolve` posts "Handled in <sha> by @<author>", `Fix anyway` puts the comment
back in the normal flow. It is always a suggestion, never an automatic resolve.
A reply the user wrote by hand after the draft, whatever its text, reads **You
replied**: `Resolve only` posts nothing (`reconcileReplyOperation` recognises it
too). **Fix went missing** (a fix sha that is neither on the branch nor on
origin, or a pushed sha origin lost) gets its own detail and the
`missing_commit` push blocker points to it. `computeThreadGitFacts` first asks
`worktree_locate_fix`: the same patch on HEAD under another sha makes the thread
`folded` (**Folded in**: it stays in the push with the remapped sha, the action
reads `Push to reply`, and the reply "Fixed in <old>, squashed into <new>" is posted
by the normal push flow after the push lands; only `on_origin` skips the push). If git cannot answer, **Re-check** (`recheckThread`) spawns a
read-only scout (`sourceKind` `comment_recheck`, FixMode `recheck`) on the
cheapest model of the provider. It ends with `<<comment-verdict threadId verdict
sha evidence>>` (`fixed-here`, `not-relevant`, `still-needed`), parsed by
`extractCommentVerdict` and stored in `resolve_threads.verdict_json`. The verdict
offers one action (Reply and resolve, Close with this reply, Fix again) and never
acts alone (where `canResolve` is false, as on Bitbucket, they read `Reply` and
`Post this reply`, and `Resolve only` is not offered); `settleItemAnswered` takes `allowIntegrated` so a missing
fix can be answered without undoing its accepted decision. The git facts live in `sessionThreadGit`, the per-thread computation in
`store/slices/resolve/threadGitState.ts`, the git side in
`src-tauri/src/thread_git.rs`.

Each comment has four verbs, with single keys while the list has focus:
`Accept` (A), `Edit` (E, `Answer` when the agent asked, `Redraft with the new
comment` when the reviewer changed it, `Add a hint` when the run failed), `Reply` (R, a reply
without a change) and `Skip` (S), plus `Undo` (U, `Resume` on a skipped
comment) until the push and `Fix` (F) on a comment nobody started, which opens
the launch strip. J and K move. A checkbox appears on hover on comments nobody
started (X toggles the focused row, Cmd+A picks every one of them, Esc clears):
the bar `3 selected · Fix 3 separately` opens the strip for the pick, and a
batch is born only from a selection or one `Fix`. Edit, Answer and Reply share one text box: Enter sends,
Shift+Enter adds a line, Esc cancels. Clicking the reply edits it in place.
`…` also offers Stop drafting, Resolve without a reply, Open in diff, Agent
transcript, Open on GitHub and Copy link. Accept and Skip move focus to the
next open comment. Accept never talks to GitHub: it marks the comment for the
push and, for a fix, lands the commit on the local branch. The actions are the
`review` and `reviewComment` kinds of the action registry
(`features/actions/kinds/`), so the buttons, `…`, the right click and the
palette list the same set.

A comment turns to Comment changed only when the reviewer edits the original
comment. Every refresh of the pull request compares the fingerprint of the root
comment with the one stored in
`resolve_threads.source_snapshot_json` when the draft was made, and a mismatch
stores the new text, who wrote it and when Goodboy saw it. A plain write to the
thread (a resolved flag, a phase) never marks it: those writes keep the draft in
step with the thread revision. `Keep the draft` adopts the new text as the
baseline and keeps the draft acceptable; `Redraft with the new comment` moves
the baseline when the agent starts. GitHub's outdated flag is a fact on the
comment (The line moved), not a state. A new reply after the draft is a fact too
(New reply from the author, with the text one click away): it never blocks Accept.

A **fix attempt** is one agent working on one or more conversations. It ends
with a local commit and never pushes.

- Goodboy reads what the commit is from git, not from the agent. A commit whose
  subject is `fixup! <subject>` of a commit on the branch shows as
  `Fixed in 9e8d7c6 · fixup of 3a1f9c2`. A revision that rewrote an earlier fix
  shows `Fixed in 7c1e0aa · replaces 4f21c8b`
- With the fixup commit style, Goodboy blames the commented line and asks the
  agent for `git commit --fixup=<sha>` of the commit that introduced it. The
  default is a new commit for every fix. Resolve never squashes or
  force-pushes; history changes only when you press Apply or Push in Rewrite
  history
- Approving a fix fast-forwards the branch to it. When the branch moved on
  since the fix started, the fix is cherry-picked onto the new head and that
  commit becomes the sha on the branch. If it no longer applies, the pick is
  aborted and the branch stays as it was. When an approval was interrupted
  after the pick landed, approving again finds the same change on the branch
  and records that commit instead of picking it twice. If recording the picked
  sha fails, preparing the publication (or **Recheck fix**) records it again
  before it checks the branch

- Every start goes through one path (`startBatch`): `Fix` on the row of a
  comment nobody started (hover) or in its detail, `F` on the focused row, or
  the Activity suggestion. The header has no "Draft fixes" button: a batch is
  born from the comments you pick. Opening Review never starts an agent.
  `Fix` opens the **launch strip**, inline under the header (never a dialog):
  the model and effort pill (the shared picker with every connected provider
  and a **Suggested** row), the commit style (`New commit` or `Fixup of the
original`, prefilled from the settings or the last batch), an optional hint
  that lands in Operator notes, a plain count line (`3 agents · up to 4 run at
once · each works on its own copy of the branch`, no price: nothing
  estimates the cost of a run), and `Start` on Cmd+Enter (Esc closes). The
  choice is saved on the batch and on every attempt (`launch_choice_json`). Each start carries the thread ids and the
  marker contract
- A retry reads the same choices again. Redraft, Answer and Try again use the
  launch choice of the comment's last batch attempt (model, effort, commit
  style, hint), then the model picked for the session (`Model for drafts…`) and
  the commit style set in Review replies, so with fixup set the second round is
  a fixup too. The
  hint you type before a retry lands in the prompt's operator notes
- A failed run offers **Try again** (`Try again on Opus 5` once you picked a
  model, `Try again with the hint` with a hint), **Try another model** (the
  picker opens inline under the buttons) and **Add a hint** (F is Try again).
  `…` holds Reply yourself, Skip and Open transcript. The earlier attempts of
  the comment fold into one line above (`Attempt 1 · Sonnet 5 · Medium ·
failed`) that opens to their reasons. A failed step after the run shows its
  own verb: `Push again`, `Post the reply again` or `Open on GitHub` when
  Goodboy could not confirm the reply landed
- A batch fix runs in its own copy of the branch, up to four at a time (the
  session limit), so two fixes never fight over the same branch. The rest wait
  with `Waiting for a free slot`
- After a restart, Goodboy rebuilds everything from its database, not from a
  chat log

Nothing reaches GitHub until you push. `Push N` in the Review header is the
one way out, for every accepted comment at once. It
confirms inline under the header with exactly what goes out (`Push 2 to
hl/fix-duplicate-credit?`, then `1 fix in 1 new commit, 2 replies, 2 threads
resolved on GitHub.`), naming the commit style set in Review replies. A
blocker (uncommitted changes, a commit nobody approved, a fix still running)
replaces the confirm with its reason and the one move that clears it. The
result stays on the layer in one line with its commit; a partial push says how
many landed and marks the comment that did not with its reason, and `Retry
push for N` picks it up. When the push failed because origin moved, `Sync and
try again` (on the comment and in the result line) asks first under the header,
then fetches origin and rebases the unpushed commits of the local branch on it
in a copy, without pushing, and checks the push again. If those commits
conflict with the new ones it stops and says so, and the branch stays as it
was. ⌘↵ with the list focused pushes too. Behind it runs a
**publication**, which:

1. Locks the conversations it will publish
2. Pushes the branch once, if there is code to send
3. Posts each reply, then resolves each thread on GitHub when you are allowed
   to resolve it there. Otherwise the thread stays open for the reviewer.

How a reply reads is set in Settings, Workspace, **Review replies**:

- **Voice**: Terse (the default), Friendly, Formal, or Like my replies, which
  follows a style note you can edit. **Learn from my replies** reads your last
  20 review replies in the workspace's repositories and writes that note. The
  voice goes into the agent's prompt
- **Templates**: When fixed and When not changing. Goodboy fills them in code,
  the agent writes only `{reason}`. The other variables are `{commit}`,
  `{commit_story}`, `{fixup_of}`, `{reviewer}`, `{file}` and `{line}`.
  `{commit_story}` is the same sha as `{commit}`, plus `c81e5aa, squashed into
e31b9f4` when a history rewrite folded the fix. Reply and page always read
  the last commit of the thread after rewrites. The defaults are the
  reason, then `Fixed in {commit_story}.` or `Leaving this as is.`
- **Sign replies** is the attribution line switch, so one value signs
  everything Goodboy posts
- **Resolve the thread after replying** (on by default) and **Commits** (new
  commit, or fixup of the commit that added the line)
- **Edit the posted reply** (on by default, stored per workspace in the
  `settings` table under `review.edit_posted_reply.<workspaceId>`, `0` = off).
  After a history rewrite is pushed and a reply Goodboy posted names a sha that
  moved, Goodboy edits that reply in place with `updateReviewComment`: it adds
  `Update: c81e5aa was squashed into e31b9f4.` (or `is now`) above the
  signature, once per sha change, and rewrites the delivery receipt body so the
  Review page shows the same text as GitHub. Replies from people are never edited. The
  per-thread history (first sha, folded or not, posted sha and body, update
  lines) lives in the `settings` table under
  `resolve.commit_story.<sessionId>.<threadId>`, so it needs no migration

Goodboy saves a receipt for every step, and the outcome it reports is read from
those receipts: a thread shows as resolved only after GitHub confirmed it. If a
publication stops halfway, it picks up at the first step without a receipt and
never pushes or posts twice. Confirming the same publication twice runs it
once. A publication is the only way a reply gets posted or a thread gets
closed.

## Settings scopes

Settings can be set at four levels. The level closest to the work wins:

**global → workspace → project → session**

- **Permission rules** can be set at all four levels. When more than one
  matches a tool call, the most specific one decides.
- **Settings overrides** (default provider, branch prefix, verbosity, role
  and task models, provider pool, parallel agents, provider bindings) can be
  set on a workspace, a project or a session, on top of the global defaults.
  Anything you leave empty comes from the level above. The session engine
  reads them only through `selectResolvedSettings`: session, then the
  session's active project, then workspace, then global (`resolveSettings` in
  core). Provider bindings merge per provider instead, and the closest level
  wins. A project override sets the branch prefix for that project's mounts.
  The settings screens edit the workspace row and read that row back, since
  it is what they change.
- **Workflows, saved steps and skills** belong to the workspace. Built-in
  steps live in code and are the same everywhere. They are read only: **Save a
  copy** puts one copy in the workspace, and that copy remembers what it is
  based on.
- **Project scripts** belong to the project, because only the project knows
  its root folder.
- **Integration bindings** use the project's own connection first, then the
  workspace one.

## Permission rules

A **permission rule** matches a tool and says **allow**, **deny** or **ask**.
It can match the whole tool or, for Bash, a command prefix ("pnpm test", not
every Bash call) so approving one command never approves the rest of Bash.
You can set it globally, or on a workspace, project or session. The most
specific rule that fits wins.

- Rules reach Claude only. The session's permission mode reaches every
  provider, and a mode a provider can't honor runs as a stricter one
  ([providers.md](providers.md#permission-modes-per-cli)); the agent's row
  then says so (`Read only · Ask first isn't available on Codex`)
- When a call is denied in a run with no one watching, the turn stops. The
  agent's row, its session card and the top bar's Needs you all read **Needs
  approval**, not running, until you answer
- The approval card's primary action, **Allow and continue**, grants that
  exact call once and resumes the turn by itself; the secondary "Always
  allow" actions write a rule (command-prefix for Bash, the whole tool for an
  edit) and need a manual retry
- Settings › Workspace › Permissions lists the rules and adds one inline
  (`Add rule`: Allow or Deny, a command prefix, this workspace or all of
  them), then the last 50 decisions of the workspace's sessions from the
  audit log (`permission_audit_list`)
- A workflow step that was denied pauses the run instead of finishing the
  step with whatever text the model produced meanwhile

## Workspace profile

Each workspace can have one profile, edited under "About you" on the workspace
page. Onboarding does not ask for it: "Tell agents about you" in the setup
checklist opens it. It has four fields:

- **Your roles**: chips from a library of about 30 roles, or your own
- **About your work**: what you do and for whom
- **How agents should work with you**: your working rules
- **Explain more when it touches**: topics where you want longer explanations

Each agent reads only the fields its job needs. The matrix is
`PROFILE_ACCESS` in `packages/core/src/profile/profileAccess.ts`, and the form
shows it under "See who reads what".

- Planner, orchestrator and the question delegate read roles, work and rules
- Scout, investigator, report and wireframe read roles, work and topics
- Implementer, tester and docs read roles and rules
- Reviewer and resolver read roles, rules and topics
- A custom role reads every field
- Task models read nothing, and the profile never goes into text Goodboy posts

Empty fields add nothing. The profile lives only in the database.

## Integrations

A connection to a tool lives on the **workspace**. Goodboy calls it a
**binding**: one login and one set of options, shared by every project.

- A project that needs a different account or setup gets its own override.
  Goodboy uses it before the workspace binding.
- GitHub works the same way. A workspace with no GitHub key of its own uses
  the key for all workspaces, then your `gh` CLI login. Both are set in one
  place, **Settings > Integrations > GitHub**, in an **All workspaces** row and a
  **This workspace** row. App settings have no GitHub section.
- Secrets stay inside Goodboy. Agents reach your tools only through the
  [query bridge](query-bridge.md).

### What integrated means

The workspace is where all the work comes together. So every tool has to be
readable inside Goodboy, not behind a link to a browser tab. A tool counts as
integrated when you can do all three:

- **See it**: the whole item shows inside Goodboy
- **Act on it**: comment, reply, assign, move, approve, merge or resolve from
  the same screen
- **Route it**: turn it into a session with the goal already written, and
  follow it back when the work ships

A routed goal carries the item's text up to 1,200 characters, or 2,000 for a
Slack thread. A longer text is cut at the last paragraph, line or sentence that
fits, never inside an open code block, and ends with a line that names the full
item and its link. Agents read the whole item through the
[query bridge](query-bridge.md). A proposed session title is cut at a word and
ends with an ellipsis.

Picking an issue in the new session draft, or opening Launch session on an
inbox issue, asks the **Issue briefs** task model for a brief: a title, a goal
of one to three sentences and up to five "done when" criteria, in the issue's
language. It reads the issue text, not its comments, and answers in checked
JSON, so a reply with a preamble fails instead of leaking into the goal. The
brief is only a proposal. In the draft you pick Use brief, Edit, Use issue
text or Dismiss, and a failure stays inline in the card with Retry. The first
three settle the title and goal and open How to work on it (`HowToWorkOnIt`,
`SessionKickoff/`) underneath: Run a workflow (preselected, the full workflow
builder with the goal filled in) or Ask an agent, precompiled with that goal
and editable. Its own action links the issue, mounts the project the issue
maps to (the same rule as Launch session in the Inbox), creates the session
and starts the workflow or agent in the same gesture; nothing exists before
that. In the
Launch session popover the brief fills the goal only while you have not edited it, and
Launch works with the issue text while the brief is still loading. Briefs are
kept in memory per issue text, so the same issue is not briefed twice. With no
connected provider free for the task, the card shows the issue text alone.
Merge and pull requests launch with their text as it is.

### Each source

- **GitHub**: read pull requests and act on them (approve, request changes,
  comment, reply, resolve threads, merge, close). Read issues and comment on
  them.
- **GitLab**: read merge requests and act on them (approve, change state,
  comment, reply, resolve and reopen threads). Merge and Close ask for
  confirmation first. Read, comment on and edit issues.
- **Bitbucket**: pull requests from start to finish, with description, diff,
  build results in plain words and review threads. Eight actions: approve,
  revoke, request changes, withdraw, comment, reply, merge, decline. Issues go
  through Jira.
- **Jira**: read full issues and act on them. Comment, assign, move to another
  status, edit the description.
- **Linear**: read issues and turn them into sessions. The description and
  comments are written back, and the status row moves the issue to another
  state of its team.
- **Sentry**: read issues and events and turn them into sessions.
- **Slack**: read threads, reply, and turn them into sessions with the goal
  filled in. Replies post as the connected user. Each workspace has its own
  Slack connection.

Linear, Jira and Sentry connect in numbered steps (`ConnectSteps`): a button
opens the page where the key is made, the pasted key is checked on its own with
no Connect button, and the last step picks from a list instead of free text
(Jira projects from `jira_list_projects`, Sentry organizations and projects
from `sentry_list_organizations` and `sentry_list_projects`). Each field uses
the tool's own name for the secret: API key on Linear, API token on Jira, auth
token on Sentry. A key saved for another workspace can be picked instead.

## Inbox

The inbox is the workspace's queue of incoming work from every connected
source: issues, pull and merge requests, Slack threads and Sentry errors, one
record each, one line per record. Records are grouped by day (today,
yesterday, this week, older) and ordered by time only, newest first. A facet
rail filters them by view (all, in progress, with a session, closed), by type
and by source, one pick per section, with counts; only the types a connected
tool can produce show. A tool that did not load says so in its source row and
in one notice above the list. The state column uses the tool's own word, the
same one the record shows. A record opens in a drawer beside the list, with the
same header, facts and sections for every tool, and the source's own actions. From it you start a session, link it to an existing session of
the workspace with Link to a session, or open the session already linked to it.
A record shows its session whichever way the link was made: launched from the
inbox, picked there, or linked from the session's own link button, by search or
by pasted URL. The session link button searches the issues of every Sentry
project linked to the workspace, not only the connected one. A code or link
pasted there goes through the same lookup as the inbox search
(`useWorkspaceIssueLookup`, scoped to the picked tracker) and links the task
`launchSpecFor` builds from the resolved record, so a Sentry short code such as
`PAYMENTS-API-3` resolves and a Sentry link keeps its short id. A paste the
lookup cannot resolve falls back to the fields read from the URL.

Launch session mounts the item's project when it maps to one
(`launchMountFor`). A Sentry error reads the projects linked to its Sentry
project and the ones a Sentry code mapping points at; a GitHub or GitLab item
reads the project whose remote is its repo. One match is mounted, several
preselect the best (linked and mapped, then a name equal to the Sentry
project) and the popover lets you pick another or none, and no match mounts
nothing. Linear, Jira and Slack items never mount one. The popover names the
project and the reason ("from Sentry project payments-api"), and the mount
keeps that reason.

Pull and merge requests come from the code hosts. GitHub lists the open pull
requests of the workspace root repo that ask for your review, plus your own
open ones updated in the last seven days, through the same `gh` login as issues
(`listInboxPullRequests`). GitLab lists open merge requests assigned to you, and
Bitbucket the pull requests of the linked repo. Open ones show as open, merged
and closed ones as closed.

With two or more projects in the workspace, the rail also filters by project,
but only when the current view includes a source that maps to projects
(`PROJECT_MAPPED_PROVIDERS`: Sentry, GitHub and GitLab) and a record there
belongs to one. A Linear, Jira or Slack view, or a view narrowed to one of
them by Source or Type, shows no Project section at all, and a pick that
leaves no mapped source drops the project filter. Projects with no records
hide behind a quiet "Show N empty" toggle at the end of the section; the
selected project stays listed even at zero, and a project's count is the
records tied to it. A GitHub or GitLab record belongs to the project whose
remote (`Project.remoteUrl`) is its repo. A tracker record never belongs to a
project; its row shows the tracker's own project or team instead. A Sentry error
belongs to every project linked to its Sentry project in Settings, Integrations,
Sentry, where each project can read several Sentry projects and one Sentry
project can serve several projects (`project_sentry_links`, m191). Links can be
suggested from Sentry code mappings and wait for your Link. The inbox reads the
first page of every linked Sentry project besides the connected one, in one
load that starts once the links are read. A Sentry call that hits a rate limit
or a gateway error is retried up to twice, waiting what `Retry-After` asks for
(at most 5 seconds), before the tool says it did not load. The project
filter applies to the mapped sources only: a Sentry, GitHub or GitLab record
tied to another project, or to none, leaves the list, while every Linear, Jira,
Slack or Bitbucket record stays. In a mixed view with a project picked, one
quiet line under the section says so (`projectFilterNote`), for example
"Project filter applies to Sentry. Linear issues aren't tied to a project, so
they stay listed." In Settings, Workspace, a project that reads Sentry shows the
Sentry glyph, and its tooltip names the Sentry projects.

## Providers and routing

Goodboy works with seven providers: **Claude**, **Cursor**, **Codex**,
**Gemini**, **OpenCode**, **OpenRouter** and **Moonshot**. You set their order
and budgets, and turn each one on or off per session. Goodboy decides where
each piece of work goes.

- When a provider passes its budget limit, the work moves to the next one. You
  pick the limit, and it starts at 80% of the cap.
- Quick tasks go to fast, cheap models. Hard design work goes to the best model
  you have.
- Each workflow step picks its model by role, level and cost. A model you pin
  yourself beats the automatic choice.
- You see what you spend as it happens.

You pick a model with the same control everywhere. It is a picker built from
the model list, by provider, model, version, variant and effort. The
[model picker](model-picker.md) page explains how it works. The
[provider guide](providers.md) explains how to sign in to each provider.

## Costs

Goodboy measures every turn on your machine and sends nothing anywhere.

- **Token usage**: input and output tokens per request, session, provider and
  model
- **Estimated cost**: a live estimate from provider prices, with a running
  total per session
- **Session events**: when a session starts, resets, hits a limit, changes
  provider or ends
- **Budgets**: a monthly budget per provider, counted across all workspaces on a
  UTC calendar month, and a spend limit per session that pauses workflows or
  only warns, with an alert before you reach them

Caps steer where work goes. They never lock you out. When every provider is
over its cap, the message box tells you. You can still send the turn on the
provider you picked.

## Skills

Skills live next to your code. They are markdown files with frontmatter, and
Goodboy finds them in every project of the workspace, in either place:

- `<project-root>/.kay/skills/*.md`
- `<project-root>/.claude/skills/<name>/SKILL.md`

Each workspace has its own list of skills. There is no global list. Call one
from the chat with `/skill-name`. A skill runs on any connected provider, not
only the one whose folder it came from.

Scripts that come with a skill run only from `<project-root>/.kay/skills`.
Skills found under `.claude/skills` are prompts only, so a cloned repository
cannot make its scripts run when you use a skill.

## Editor

When you want to type code yourself, Goodboy opens your editor on the right
worktree and branch. It finds **VS Code** and **Cursor** by itself. If you have
both, a dropdown lets you pick. When you are done, you pick the task up again
in Goodboy.

## Under the hood

### Vocabulary rules

- Each word has one meaning. **workspace** is the container, **project** is
  the repo or folder, **session** is the goal, **agent** is the chat.
- No screen may use a different word for any of these four
- Internal words stay in code and technical docs. The screen says the word the
  user already knows from git, the file system or the rest of the app:

  | Internal word       | On screen                                         |
  | ------------------- | ------------------------------------------------- |
  | mount, branch mount | worktree (repo), folder (folder project), project |
  | mount a project     | Add project                                       |
  | fork a mount        | New worktree                                      |
  | unmount             | Close worktree, and Reopen for a closed row       |
  | spawn               | Start (an agent, a reviewer, an implementer)      |
  | handoff             | Suggested next: Implementer, the next brief       |
  | cluster             | part (in a plan), subagent (once it runs)         |
  | lens                | tab                                               |
  | studio              | the page name alone: Workflows, Impact, Providers |
  | materialize         | add to this session                               |

  `jargon-copy.test.ts` fails when rendered copy under `features/`,
  `app/components/` or `shared/components/` uses one of the internal words.
  Its baseline lists only text that agents read (prompts, bridge errors) and
  can only shrink.

- A word that stays and still needs a sentence (workflow, orchestrated,
  artifact) gets a `TermHint`: the word is underlined with dots and opens a
  one-line definition on click or keyboard focus, never on hover and never on
  its own. The definitions live once, in `GLOSSARY`
  (`apps/desktop/src/features/session/glossary.ts`).
- Every screen follows the task order: the task, then integrations, then code,
  then chat. A screen that puts chat before the task has the order wrong.
- Integrations share the layout, never the logic. A Sentry issue and a GitHub
  pull request look alike because they use the same page layout component.

### Identifiers

Session stages, in `SessionStage`: `attention` (**needs you**), `running`,
`review` (**in review**), `building`, `done`.

Agent kinds, in `AGENT_KIND_ORDER`:

| Kind          | Label            | Started from                    |
| ------------- | ---------------- | ------------------------------- |
| `planner`     | Plan             | spawn menu                      |
| `scout`       | Scout            | spawn menu                      |
| `implementer` | Implement        | spawn menu                      |
| `debugger`    | Debug            | spawn menu                      |
| `tester`      | Test             | spawn menu                      |
| `reviewer`    | Review           | spawn menu                      |
| `pr-reviewer` | PR reviewer      | PR review session               |
| `docs`        | Docs             | spawn menu                      |
| `report`      | Report           | workflow step                   |
| `wireframe`   | Wireframe        | workflow step                   |
| `resolver`    | Resolve          | Review lens                     |
| `rewriter`    | History rewriter | a history replay that conflicts |
| `scribe`      | Scribe           | pull request panel              |
| `generic`     | Generalist       | spawn menu                      |

Other identifiers:

- Project kinds: `repo`, `folder`
- `ProviderId`: `anthropic`, `cursor`, `codex`, `gemini`, `opencode`,
  `openrouter`, `moonshot`, shown as Claude, Cursor, Codex, Gemini, OpenCode,
  OpenRouter and Moonshot
- `ArtifactKind`: `plan`, `report`, `wireframe`
- `ArtifactStatus`: `active`, `consumed`, `superseded`, `discarded`
- Plans sit between `<<plan>>` and `<</plan>>` markers
- Reports and wireframes sit inside an `<<artifact v=1 kind=...>>` envelope.
  The line after the marker is a JSON header with title, format and metadata.
  The content follows it as raw text up to `<</artifact>>`, so markdown is
  never escaped into a JSON string. The parser still reads the older single
  JSON object body, and repairs raw newlines, stray quotes and smart quotes in
  it. It also reads a block wrapped in a plain or `json` code fence
  (`packages/core/src/artifacts/envelopeBody.ts`,
  `packages/core/src/artifacts/locateArtifactBlocks.ts`).
- A review conversation is a `resolve_threads` row. A fix attempt is a
  `resolve_attempts` row.

An agent materializes a project through the query bridge like this:

```bash
"$GOODBOY_BIN" query project materialize <name> --reason "<why>"
```

### Where things live

- `packages/types/src/session-view.ts`: `SessionStage`
- `apps/desktop/src/store/slices/session-view/deriveSessionStage.ts`: works
  out a session's stage
- `apps/desktop/src/store/slices/session-view/sessionStageRequest.ts`: picks the
  worst request across a session's mounts
- `apps/desktop/src/store/slices/live-work/selectLiveWork.ts`: the one answer to
  "what is live right now"
- `apps/desktop/src/features/session/agent-kind.ts`: kind labels, their order,
  which ones show in the spawn menu, and kind prompts
- `packages/core/src/roles.ts`: the list of roles and the default model for
  each
- `packages/types/src/artifact.ts`: artifact kinds, statuses and metadata
- `packages/core/src/context/marker-parsing.ts`: reads plan markers
- `packages/types/src/provider-registry.ts`: `ProviderId`
- `apps/desktop/src-tauri/src/skills.rs`: finds skills
- `packages/core/src/profile/profileAccess.ts`: which profile fields each
  role reads
- `apps/desktop/src-tauri/src/query_bridge/project.rs`: the `materialize` verb
- `packages/db/src/queries/resolve-thread.ts`: review conversations
