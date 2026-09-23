# Concepts

> **Read this when** you need to know what a Goodboy object is: a workspace,
> a project, a session, an agent and its kind, a workflow run, an artifact, a
> lens, a resolver, a permission rule, or how far an integration goes. **Not
> for** the code that implements them ([architecture.md](architecture.md)) or
> how a surface should look (`DESIGN.md`).

This page names the handful of objects Goodboy is built from and says what
each one means. Every other document links here instead of defining them again.

## At a glance

- **Workspace**: the container you work in, named after what you work on
- **Project**: one repository or folder inside a workspace
- **Session**: one task, with its own goal, budget and shared context
- **Agent**: one chat thread inside a session, on its own provider and model
- **Workflow**: a reusable sequence of steps, each run by its own agent
- **Artifact**: a plan, report or wireframe an agent saves with its own page
- **Lens**: one view onto a session, such as its plans, questions or diff
- **Turn**: one prompt from you and one response from the agent

## How they fit together

A workspace holds projects and sessions. A session holds agents, workflow
runs and artifacts, and reaches into projects only when the work needs them.

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

A few rules hold everywhere:

- A single repository is a workspace with one project
- A session belongs to the workspace, never to a project
- Every session has at least one agent, created with it
- Goodboy never runs git init, never commits and never adds a remote for you

The app follows the life of a task, in this order: the task itself, then the
tools it comes from and returns to, then the code it produces, then the chat.

## Workspaces and projects

A **workspace** is named after the thing you work on, not after a folder on
disk. It owns your profile, the integration bindings, one or more projects,
and every session.

A **project** is one place where code or files live, with a root path on disk:

- A git repository, kind `repo`
- A plain folder, kind `folder`

A project belongs to exactly one workspace. It carries only what is truly
per-place: its scripts, its settings override and an optional integration
binding override.

The new-workspace form offers **Single project**, **Multi project** and
**Standalone**. All three set up the projects of one workspace. They are not
different kinds of workspace, and no workspace links to another
([ADR 001](adr/001-workspace-project-rename.md)).

A repo project needs usable git state before a session can create a worktree
in it.

## Sessions

A **session** is a container for a goal, with its own directory, budget and
shared context. "Refactor authentication domain" is a session.

Its stage is worked out from what the session holds, never set by hand. On the
board the stages are the columns:

- **building**
- **running**
- **needs you**
- **in review**
- **done**

## Lazy sessions

A new session starts with only a **container directory** and no worktree or
branch. By default it lives at
`~/.goodboy/sessions/<workspace-slug>/<session-slug>-<id>`, or under the
sessions root the workspace sets.

A project enters the session when it is **materialized**, which mounts it:

- A repo project gets a git worktree inside the container, named after the
  project
- A folder project gets a plain directory under `<project-root>/sessions/`

Materializing happens on demand, in four ways:

1. A workflow step that writes files reads the run goal, the step prompt and
   the plan it consumes. Any project named there is materialized before the
   step starts. This is how a planner declares which projects the work touches.
2. You press the **+ project** chip in the session's scope bar.
3. An agent asks for it through the [query bridge](query-bridge.md).
4. The first turn in a workspace with exactly one project materializes that
   project.

Every materialization needs a reason and is recorded in the session's
activity. A blank reason is refused before anything runs.

The branch is `<prefix>/<session-slug>`, the same name in every project the
session touches. The repository slug on each mount tells them apart.

Until a project is materialized, agents may read its root, but every write
must land inside the container or a mounted project.

### Mounts

One repository can have several mounts in the same session. Each mount has
its own worktree, current branch and pull request history.

- **Switch** changes the branch of one mount
- **Fork** creates another mount from a base you choose and leaves the source
  as it was
- A raw `git checkout` inside a mount is recorded as a mismatch, and waits for
  you to choose switch or fork, since the checkout alone does not say what you
  meant

Unmounting detaches one mount and keeps its history. Cleanup removes the
worktree and keeps its local branch. A mount with uncommitted work, a lock or
a process still using the directory is not removed, and stays tracked for a
later cleanup.

The **Overview** groups sibling mounts by project. Every row has its own
terminal, diff and pull request navigation.

## Activity

A session records what happened to it as an ordered list of events. The
**Activity** timeline shows them grouped by day, so you can read the session
back as the story of the work instead of scrolling chats.

Events include:

- The container and branches being created
- Issues linked and unlinked
- One pull request per project, through its lifecycle
- Workflow runs started and discarded
- Changes to the decisions
- Projects materialized, with their reason, and materializations refused, with
  the failure
- External tasks created from Goodboy

An action that cannot say why it happened is refused, never recorded blank.

## Agents

An **agent** is an independent chat thread inside a session. Spawn as many as
you want, switch between them with a click and rename them inline.

Each agent has its own provider, model, effort, verbosity and kind.

Spawning an agent needs no workflow. Attaching a workflow creates one agent
per step, and those agents live alongside any you add yourself.

### Agent kinds

The **kind** shapes how an agent works: what it may touch and what it hands
back. Each kind carries a default model, effort and an optional system prompt.

Goodboy infers the kind from the agent's name or first message, or you choose
it when you spawn the agent.

- **Plan**, **Scout**, **Implement**, **Debug**, **Test**, **Review**,
  **Docs** and **Generalist** are in the spawn menu
- **Report** and **Wireframe** run as workflow steps
- **PR reviewer** opens a session that reviews someone else's pull request
- **Resolve** is started from the **Review** lens to fix review comments

The identifier behind each label is in [Under the hood](#under-the-hood).

## Workflows

A **workflow** is a reusable sequence of steps. Attach a ready workflow from
the sidebar or build your own. It can carry an optional goal, which you can
change per run.

- **Runs are separate.** Attaching a workflow starts a run. The same workflow
  can run again and again in one session, and each run stands on its own.
- **You choose when a run starts.** On attach (the default), when you start it,
  or after a previous run completes. A chained run waits for the one before
  it, then goes on by itself.
- **Drafts stay while you move.** A workflow you are building is kept as you
  switch sessions, and cleared when you create or discard it.
- **Describe it in words.** Goodboy turns a description into a draft of the
  steps, which you edit before attaching.

[Workflows](workflows.md) covers how a run advances, step by step.

## Artifacts

When an agent writes a **plan**, a **report** or a **wireframe**, Goodboy saves
it as an artifact of the session, with its own page, instead of leaving it in
the chat.

An artifact has a status:

- **active**: waiting for the next agent
- **consumed**: an agent has acted on it
- **superseded**: a newer version replaced it
- **discarded**: removed from the session

### Plans

Planner agents write plans. Other agents consume them, and Goodboy tracks who
consumed what. The plans studio shows each plan as a tree.

A plan is also where the planner declares which projects the work touches,
and that is what materializes them when an implementing step starts.

## Shared context and lenses

Agents in the same session do **not** share their chat history. What they
share is the **session record** on the **Overview**:

- The goal, the decisions and the session summary, in that order
- What the session produces as sections of the same page: workflows, agents,
  review, questions, diff and plans

Goodboy fills in the goal, decisions and summary after every turn. You can
edit them by hand too.

Each of those sections is a **lens**: a view onto the session, opened from
rows and chips on the **Overview**. It expands in place or opens in a side
panel, and prose renders as markdown.

Chat is one lens among the others, not the frame around them. Switching agents
swaps the transcript while the **Overview** stays put, because the record
belongs to the session, not to the agent. That is how independent agents work
on one goal without mixing their threads.

A **turn** is one prompt from you and one response from the agent, including
everything streamed in between.

## Pull request review

A **diff comment** is your note on a line under review.

A **review conversation** is the lasting record of one review, issue or diff
comment. It holds its state, its verdict, its draft reply and the commits that
answer it.

A **fix attempt** is one agent working on one or more conversations and
leaving a local commit, never a push.

- Attempts run one at a time on the session worktree, so two fixes never race
  on the same branch
- After a restart everything is rebuilt from the database, not from a
  transcript

Nothing reaches GitHub until a **publication** runs. A publication:

1. Freezes the conversations it will publish
2. Pushes the branch once, if code has to travel
3. Posts each reply and resolves each thread

Every step is recorded, so an interrupted publication resumes without posting
twice. The publication is the only path that pushes a reply or closes a thread.

## Scoping ladder

Settings live at four scopes, and the one closest to the work wins:

**global → workspace → project → session**

- **Permission rules** exist at all four scopes. When several match a tool
  call, the most specific one decides.
- **Settings overrides** (default provider, branch prefix, verbosity, model
  pins, provider pool) sit at workspace and session scope on top of the global
  defaults. Anything unset is inherited from the scope outside it. A project
  override sets the branch prefix of that project's mounts.
- **Workflows, the step library and skills** belong to the workspace. A step
  library entry with no workspace is a global seed.
- **Project scripts** belong to the project, the only object that knows its
  root path.
- **Integration bindings** use the project override first, then the workspace
  binding.

## Permission rules

A **permission rule** matches a tool and chooses **allow**, **deny** or
**ask**, at global, workspace, project or session scope. The most specific
rule that applies wins.

- What the provider supports decides how the rule is enforced
- A denied call in a headless run blocks the turn
- Approval is explicit, and you can retry after approving

## Workspace profile

Each workspace has at most one profile: a free-form bio you write in your own
words, under the prompt "Tell agents who you are and what you do here".

- The bio goes verbatim into every agent prompt, framed as what you say about
  yourself
- An empty bio adds nothing
- Saving it also writes a plain copy to
  `~/.goodboy/workspaces/<slug>/PROFILE.md`

The database is the source of truth. The file is written, never read back.

## Integrations

A connection is a **binding on the workspace**: one credential and one
configuration, shared by every project.

- A project that needs a different account or configuration gets its own
  override, used before the workspace binding
- GitHub works the same way, and a workspace with no GitHub credential of its
  own uses your `gh` CLI login
- Secrets stay inside Goodboy. Agents reach your tools only through the
  [query bridge](query-bridge.md).

### What integrated means

The workspace is where the work comes together, so every tool has to be
readable inside Goodboy, not linked out to a browser tab. An integration counts
when you can do all three:

- **See it**: the item shown in full inside Goodboy
- **Act on it**: comment, reply, assign, transition, approve, merge or
  resolve from the same screen
- **Route it**: turn it into a session with the goal written, and follow it
  back out when the work ships

### Each source

- **GitHub**: pull requests read and acted on (approve, request changes,
  comment, reply, resolve threads, merge, close). Issues read and commented.
- **GitLab**: merge requests read and acted on (approve, state changes,
  comment, reply, resolve and reopen threads). Issues read, commented and
  edited.
- **Bitbucket**: pull requests end to end, with description, diff, build
  statuses in plain language and review threads. Eight actions: approve,
  revoke, request changes, withdraw, comment, reply, merge, decline. Issues
  are handled through Jira.
- **Jira**: issues read in full and acted on: comment, assign, transition,
  edit description.
- **Linear**: issues read and routed, with the description and comments
  written back.
- **Sentry**: issues and events read and routed into sessions.
- **Slack**: threads read and replied to, routed into sessions with the goal
  filled in. Replies post as the connected user, and the connection is per
  workspace.

## Providers and routing

Goodboy works with seven providers: **Claude**, **Cursor**, **Codex**,
**Gemini**, **OpenCode**, **OpenRouter** and **Moonshot**. You set their
priority and budgets and turn them on or off per session, and Goodboy routes
the work.

- When one provider passes its budget threshold, work moves to the next. You
  pick the threshold, and it starts at 80% of the cap.
- Quick tasks go to fast, cheap models, complex architecture to the best one
  available.
- Each workflow step picks its model by role, tier and cost. A model you pin
  yourself wins over the automatic choice.
- You see the spend as it happens.

Choosing a model is one control used in many places: a picker built from the
model catalog, by provider, model, version, variant and effort. The
[model picker](model-picker.md) page covers how it works, and the
[provider guide](providers.md) covers sign-in for each provider.

## Costs

Every turn is measured on your machine, and nothing is sent anywhere.

- **Token usage**: input and output tokens per request, session, provider and
  model
- **Estimated cost**: a live estimate from provider pricing, with a running
  total per session
- **Session events**: when a session starts, resets, hits a threshold,
  switches provider or ends
- **Budgets**: a monthly cap per provider and a soft cap per session, with an
  alert before you reach them

Caps steer routing, they do not lock you out. When every provider is over its
cap the composer tells you, and you can still send the turn on the provider
you picked.

## Skills

Skills live with your code: markdown files with frontmatter, found in every
project of the workspace at either path:

- `<project-root>/.kay/skills/*.md`
- `<project-root>/.claude/skills/<name>/SKILL.md`

They are registered per workspace, not globally. Call one from chat with
`/skill-name`. A skill runs on any connected provider, not only the one whose
folder it came from.

## Editor

When it is time to type code yourself, Goodboy opens your editor on the right
worktree and branch. **VS Code** and **Cursor** are detected on their own, and
when both are installed a dropdown lets you choose. When you are done, you pick
up the task in Goodboy again.

## Under the hood

### Vocabulary rules

- Each word has one meaning: **workspace** is the container, **project** is
  the repo or folder, **session** is the goal, **agent** is the thread
- No surface may introduce a synonym for any of the four
- Every surface follows the task order: task, then integrations, then code,
  then chat. A surface that shows chat before the task is built upside down.
- Integrations share the layout, never the logic. A Sentry issue and a GitHub
  pull request look alike because the page anatomy is one shared primitive.

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
- Plans are emitted between `<<plan>>` and `<</plan>>` markers
- Reports and wireframes use an `<<artifact v=1 kind=...>>` envelope
- A review conversation is a `resolve_threads` row, a fix attempt is a
  `resolve_attempts` row

Materializing from an agent, through the query bridge:

```bash
"$GOODBOY_BIN" query project materialize <name> --reason "<why>"
```

### Where things live

- `packages/types/src/session-view.ts`: `SessionStage`
- `apps/desktop/src/store/slices/session-view/deriveSessionStage.ts`: how a
  session's stage is worked out
- `apps/desktop/src/features/session/agent-kind.ts`: kind labels, order,
  spawn menu visibility, kind prompts
- `packages/core/src/roles.ts`: role registry, default model per role
- `packages/types/src/artifact.ts`: artifact kinds, statuses, metadata
- `packages/core/src/context/marker-parsing.ts`: plan marker parsing
- `packages/types/src/provider-registry.ts`: `ProviderId`
- `packages/core/src/skills/registry.ts`: skill discovery
- `apps/desktop/src-tauri/src/profile_file.rs`: the `PROFILE.md` projection
- `apps/desktop/src-tauri/src/query_bridge/project.rs`: the `materialize` verb
- `packages/db/src/queries/resolve-thread.ts`: review conversations
