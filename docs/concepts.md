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
- Git state is created or rewritten only when you ask: initializing a repo,
  amend, squash, a resolve attempt. Never by a mount or a turn, and nothing is
  pushed without a publish

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

The new-workspace form offers **Single project**, **Multi project** and
**Standalone**. All three set up the projects of one workspace. They are not
different kinds of workspace, and a workspace never links to another one
([ADR 001](adr/001-workspace-project-rename.md)).

A repo project needs a working git setup before a session can make a worktree
in it.

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

Every event has a reason. If an action cannot say why it happened, Goodboy
refuses it instead of saving a blank entry.

The header counts the rows that wait on you ("2 need you") and jumps to the
first one. **Filter** opens one panel with every kind of row at once, in three
groups: Work (agents, workflows, questions, suggestions), Outputs (artifacts
with plans, reports and wireframes, pull requests, issues) and Session log
(branches and worktrees, resolver, decisions, session events). Each row shows
how many of its kind the session holds. Presets set the whole filter in one
click: **Everything**, **Work**, and **Needs you**, which shows only what
waits on you whatever the filter hides and lasts until you leave it. The
filter shows once the feed holds more than one kind of row. **Start agent**
is the one primary, and its menu starts a workflow, a report or a wireframe.

## Agents

An **agent** is a separate chat inside a session. Start as many as you want,
switch between them with a click and rename them in place.

Each agent has its own provider, model, effort, verbosity and kind.

You do not need a workflow to start an agent. When you attach a workflow,
Goodboy starts one agent per step. Those agents sit next to any you added
yourself.

An agent finishes on its own. Once its last turn succeeded, it has no open
question of its own, no turn is starting or running and no child still works,
it moves to the finished agents without a click. Sending it a new message
opens it again. There is no "mark done".

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
- **Saved, then delivered.** An answer is saved the moment you give it, but it
  reaches the asking agent only once that agent has no open question left.
  Then all its answers travel in one turn and are marked delivered. Answered
  and delivered are two different facts.

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
used which plan. The plans studio shows each plan as a tree.

A plan also says which projects the work touches. When a step that writes
code starts, Goodboy materializes those projects.

## Shared context and lenses

Agents in the same session do **not** see each other's chats. What they share
is the **session record** on the **Overview**:

- The goal, the decisions and the session summary, in that order
- What the session produces, as sections of the same page: workflows, agents,
  review, questions, diff and plans

Goodboy updates the goal, decisions and summary after every turn. You can
edit them yourself too.

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

A **diff comment** is your note on a line of the code under review.

A **review conversation** is Goodboy's saved record of one review, issue or
diff comment. It keeps its state, its verdict, its draft reply and the commits
that answer it.

A **fix attempt** is one agent working on one or more conversations. It ends
with a local commit and never pushes.

- Fixes run one at a time in the session worktree, so two fixes never fight
  over the same branch
- After a restart, Goodboy rebuilds everything from its database, not from a
  chat log

Nothing reaches GitHub until a **publication** runs. A publication:

1. Locks the conversations it will publish
2. Pushes the branch once, if there is code to send
3. Posts each reply and resolves each thread

Goodboy saves every step. If a publication stops halfway, it picks up where it
left off and never posts twice. A publication is the only way a reply gets
posted or a thread gets closed.

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
- **Workflows, the step library and skills** belong to the workspace. A step
  library entry with no workspace is a built-in starter step for everyone.
- **Project scripts** belong to the project, because only the project knows
  its root folder.
- **Integration bindings** use the project's own connection first, then the
  workspace one.

## Permission rules

A **permission rule** matches a tool and says **allow**, **deny** or **ask**.
You can set it globally, or on a workspace, project or session. The most
specific rule that fits wins.

- How the rule is enforced depends on what the provider supports
- When a call is denied in a run with no one watching, the turn stops
- You approve on purpose, and you can retry after approving

## Workspace profile

Each workspace can have one profile. It is a short bio you write in your own
words, under the prompt "What agents should know about this workspace and you".

- The bio goes word for word into every agent's prompt, as what you say about
  yourself
- An empty bio adds nothing
- When you save it, Goodboy also writes a plain copy to
  `~/.goodboy/workspaces/<slug>/PROFILE.md`

The database holds the real copy. Goodboy writes the file but never reads it
back.

## Integrations

A connection to a tool lives on the **workspace**. Goodboy calls it a
**binding**: one login and one set of options, shared by every project.

- A project that needs a different account or setup gets its own override.
  Goodboy uses it before the workspace binding.
- GitHub works the same way. A workspace with no GitHub key of its own uses
  the key for all workspaces, then your `gh` CLI login. Both are set in one
  place, **Settings > Tools > GitHub**, in an **All workspaces** row and a
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

Picking an issue in the session kickoff, or opening the launch dock on an
inbox issue, asks the **Issue briefs** task model for a brief: a title, a goal
of one to three sentences and up to five "done when" criteria, in the issue's
language. It reads the issue text, not its comments, and answers in checked
JSON, so a reply with a preamble fails instead of leaking into the goal. The
brief is only a proposal. In the overview you pick Use brief, Edit, Use issue
text or Dismiss, and a failure stays inline in the card with Retry. The brief
renames the session only when you have not renamed it yourself, and the goal it
writes lands in the goal history, so the previous goal can be restored. In the
launch dock the brief fills the goal only while you have not edited it, and
Launch works with the issue text while the brief is still loading. Briefs are
kept in memory per issue text, so the same issue is not briefed twice. With no
connected provider free for the task, the card shows the issue text alone.
Merge and pull requests launch with their text as it is.

### Each source

- **GitHub**: read pull requests and act on them (approve, request changes,
  comment, reply, resolve threads, merge, close). Read issues and comment on
  them.
- **GitLab**: read merge requests and act on them (approve, change state,
  comment, reply, resolve and reopen threads). Read, comment on and edit
  issues.
- **Bitbucket**: pull requests from start to finish, with description, diff,
  build results in plain words and review threads. Eight actions: approve,
  revoke, request changes, withdraw, comment, reply, merge, decline. Issues go
  through Jira.
- **Jira**: read full issues and act on them. Comment, assign, move to another
  status, edit the description.
- **Linear**: read issues and turn them into sessions. The description and
  comments are written back.
- **Sentry**: read issues and events and turn them into sessions.
- **Slack**: read threads, reply, and turn them into sessions with the goal
  filled in. Replies post as the connected user. Each workspace has its own
  Slack connection.

## Inbox

The inbox is the workspace's queue of incoming work from every connected
source: issues, pull and merge requests, Slack threads and Sentry errors, one
record each. Records are grouped by age (today, yesterday, this week, older),
with alerts first in each group, and you can filter them by kind. A record
opens in full with the source's own actions. From it you start a session, or
open the session already linked to it.

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
- **Budgets**: a monthly cap per provider and a soft cap per session, with an
  alert before you reach them

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
  | cluster             | subagent                                          |
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

| Kind          | Label       | Started from      |
| ------------- | ----------- | ----------------- |
| `planner`     | Plan        | spawn menu        |
| `scout`       | Scout       | spawn menu        |
| `implementer` | Implement   | spawn menu        |
| `debugger`    | Debug       | spawn menu        |
| `tester`      | Test        | spawn menu        |
| `reviewer`    | Review      | spawn menu        |
| `pr-reviewer` | PR reviewer | PR review session |
| `docs`        | Docs        | spawn menu        |
| `report`      | Report      | workflow step     |
| `wireframe`   | Wireframe   | workflow step     |
| `resolver`    | Resolve     | Review lens       |
| `generic`     | Generalist  | spawn menu        |

Other identifiers:

- Project kinds: `repo`, `folder`
- `ProviderId`: `anthropic`, `cursor`, `codex`, `gemini`, `opencode`,
  `openrouter`, `moonshot`, shown as Claude, Cursor, Codex, Gemini, OpenCode,
  OpenRouter and Moonshot
- `ArtifactKind`: `plan`, `report`, `wireframe`
- `ArtifactStatus`: `active`, `consumed`, `superseded`, `discarded`
- Plans sit between `<<plan>>` and `<</plan>>` markers
- Reports and wireframes sit inside an `<<artifact v=1 kind=...>>` envelope
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
- `apps/desktop/src/features/session/agent-kind.ts`: kind labels, their order,
  which ones show in the spawn menu, and kind prompts
- `packages/core/src/roles.ts`: the list of roles and the default model for
  each
- `packages/types/src/artifact.ts`: artifact kinds, statuses and metadata
- `packages/core/src/context/marker-parsing.ts`: reads plan markers
- `packages/types/src/provider-registry.ts`: `ProviderId`
- `packages/core/src/skills/registry.ts`: finds skills
- `apps/desktop/src-tauri/src/profile_file.rs`: writes `PROFILE.md`
- `apps/desktop/src-tauri/src/query_bridge/project.rs`: the `materialize` verb
- `packages/db/src/queries/resolve-thread.ts`: review conversations
