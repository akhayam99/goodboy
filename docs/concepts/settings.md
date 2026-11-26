# Settings, profile and editor

> **Read this when** you add a setting, change which level a value comes from,
> how a setting saves, what the workspace profile holds and who reads it, or
> where an Open verb opens. **Not for** permission rules
> ([permissions.md](permissions.md)) or the Settings page names
> ([vocabulary.md](vocabulary.md)).

## Four levels

Settings can be set at four levels, and the level closest to the work wins:
**global → workspace → project → session**.

- **Permission rules** can be set at all four, and the most specific match
  decides.
- **Settings overrides** (default provider, branch prefix, verbosity, role and
  task models, provider pool, parallel agents, provider bindings) sit on a
  workspace, a project or a session, on top of the global defaults. Only a
  workspace or a session holds role and task models. An empty value comes from
  the level above.
- **Workflows and saved steps** belong to the workspace. Built-in steps live in
  code and are read only: **Save a copy** puts one in the workspace, which
  remembers what it is based on.
- **Project scripts** belong to the project, which alone knows its root folder.
- **Integration bindings** use the project's own connection first, then the
  workspace's.

### How a value resolves

The session engine reads settings only through `selectResolvedSettings`:
session, then the session's active project, then workspace, then global
(`resolveSettings` in core).

- Role models, task models and provider bindings merge key by key: a session
  that pins only the orchestrator keeps the workspace's other pins. The role and
  task maps skip the project.
- The provider list stays whole: the closest level that sets one replaces it.
- A project override sets the branch prefix for that project's mounts.
- The settings screens edit and read back the workspace row.

Role or task models a project held in an older version stay as saved settings
(`legacy.projectModels.<projectId>`, written by m228). **Models** says they no
longer apply, and **Show** lists each project with **Apply to this page** and
**Discard**, both behind a confirm on the button.

A workspace row a folder can override says how many folders hold their own
value (`countFoldersWithOwn`). A folder's value is marked **From project**, a
session's **From session** (`levelOfSetting`, `levelChipLabel`). Which levels can
hold a setting is one table, `OVERRIDE_REACH`; the reply, attribution and
workflow-rule settings are workspace only and never show a chip.

## Saving an override

The workspace override row has one declared column list per layer,
`OVERRIDE_COLUMNS` in `packages/types/src/override-columns.ts` and in
`settings_overrides.rs`. The database, the Rust get and set commands and the
backup export and import build their SQL from it. A test fails when a migrated
`workspaces` column is missing from the list, when the Rust settings struct, the
Rust bundle struct or the TypeScript bundle type disagree with it, or when the
two lists drift. So a new override adds one column to both lists and fails the
build until the bundle carries it, and a restore never drops a setting.

One Rust command writes the columns, `patch_workspace_overrides`:

- A save sends only the keys it changes, so a window with an older row cannot
  overwrite another window's save.
- It refuses, with a named error and no write, an unknown key, a wrong type, a
  value the column does not allow and a workspace that does not exist.
- It returns the stored row, which the screens show.
- Saves of one workspace run in order; a failed save rolls back only its own
  keys.

### A failed save stays on its row

A switch, choice or text field on a This Mac or workspace page shows the new
value while it saves.

- On failure the old value comes back and the row says "Couldn't save. Still
  hb." with **Retry**, which resends the failed value to the same workspace.
- No toast while the page is open; a toast only when it closed before the
  answer.
- Saves of one row run in order, and an answer for an older change is dropped.

The hook is `useSettingSave` (`settingRowKey`, `rowSaves`), wrapped by
`useAppSettingSave` and `useWorkspaceOverrideSave`. `SettingRow` takes it as
`save` and writes the error under its help line, and its reset uses the same
save.

## Workspace profile

Each workspace can have one profile, under "About you" on the workspace page.
Onboarding does not ask for it; "Tell agents about you" in the setup checklist
opens it. Its fields:

- **Your job**: chips from about 30 roles, or your own
- **About your work**: what you do and for whom
- **How agents should work with you**: your working rules
- **Explain more when it touches**: topics you want explained at length

Empty fields add nothing. The profile lives only in the database and never goes
into text Goodboy posts.

Each agent reads only the fields its job needs. The matrix is `PROFILE_ACCESS`
(`packages/core/src/profile/profileAccess.ts`), shown in the form under "See
who reads what":

- planner, orchestrator and question delegate: roles, work and rules
- scout, investigator, report and wireframe: roles, work and topics
- implementer, tester and docs: roles and rules
- reviewer: roles, rules and topics
- resolver: roles and topics, never the rules, because it works unattended and a
  chat rule ("ask before changing") would stop it
- a custom role: every field
- task models: nothing, except **Learnings**, which reads the topics

After a turn of a role that reads the topics, the Learnings task keeps a learning
only when the agent concretely explained one of them. A learning is a
`session_context_items` row of kind `learning` (topic, title, a few sentences,
its turns). It is written for you, never sent to an agent, and outlives its
session. **Dismiss** hides it with **Undo**, and `context.learnings` set to
`false` turns the task off.

## Editor and Open with

Goodboy opens your editor on the right worktree and branch, and finds the
installed editors by itself. **Settings › This Mac › Editor, terminal, git ›
Open with** picks the editor, the terminal app (Terminal.app, iTerm, Warp or
Ghostty, as installed), the browser (from **System
default**; a ⌘-click, wireframes and anything opened outside a session go
there) and **Links in a session**: **In Goodboy** (the default, a tab beside the
session) or **In your browser**. Up to four options show as a segmented control,
more as a list. A removed browser falls back to the system browser, with a note
in Settings.

One function, `openTarget`, decides where each target opens
([../browser.md](../browser.md#the-click-rule)). The Open verbs of the action
registry (`features/actions/kinds/`) go through it, and a failed open shows on
the run line with Retry.
