# Lazy sessions and mounts

> **Read this when** you change when a session gets a folder, a worktree or a
> branch, or what a mount, Unmount, Cleanup and Storage do. **Not for** the
> worktree layout and the mount lifecycle ([../mounts.md](../mounts.md)) or
> what a workspace and a folder are ([workspaces.md](workspaces.md)).

## Where a turn writes

A new session starts with no folder, no worktree and no branch. A turn that runs
before anything is mounted writes to a scratch folder,
`~/.goodboy/scratch/<session-id>`, unless the workspace holds a plain folder.
Agents can read a project's root folder before it is materialized, but every
write goes into the scratch folder or a mounted project.

A plain folder (a folder project, no git) is never copied. Its sessions work in
the folder itself, one writer at a time: a second session that wants to write
waits and can still read and answer. Nothing Goodboy makes lands inside the
folder, and a session that already writes in a `<project-root>/sessions/<name>`
folder keeps it.

## Materialize

A repo project joins the session when Goodboy **materializes** it as a **mount**:
a git worktree under the repository's own `.goodboy/worktrees/`. It happens only
when the work needs it:

1. A workflow step that writes files materializes every project named in the run
   goal, the step prompt and the plan it follows, before it starts. This is how
   a planner says which projects the work touches.
2. You press the **+ project** chip in the session's scope bar.
3. An agent asks through the [query bridge](../query-bridge.md).
4. In a workspace with exactly one project, the first turn materializes it.

Each needs a reason, saved in the session's activity; a blank reason is refused
before anything happens. An agent asks like this (the verb lives in
`apps/desktop/src-tauri/src/query_bridge/project.rs`):

```bash
"$GOODBOY_BIN" query project materialize <name> --reason "<why>"
```

A project made with **Start a new project** is the exception until published.
Its first lap works in the project folder on `main`, and no trigger cuts a
worktree, because the only commit holds `.gitignore`. Once `main` is on a code
host, the work left in the folder moves into a session named `bootstrap`, and
later sessions are ordinary worktrees ([../mounts.md](../mounts.md) → The first
lap and the bootstrap move).

The branch is named by the workspace template, `<prefix>/<task-id>-<session-slug>`
by default and `<prefix>/<session-slug>` without a task
([../mounts.md](../mounts.md)). It has the same name in every project the
session touches; the repository name on each mount tells them apart.

## Mounts

One repository can have several mounts in a session, each with its own
worktree, current branch and pull request history. The **Overview** groups the
mounts of one project, each row with its own terminal, diff and pull request
links.

- **Switch** moves one mount to another branch. **Fork** makes a new mount from a
  base you pick and leaves the original as it was.
- A `git checkout` run by hand inside a mount marks it as a mismatch, and
  Goodboy waits for you to pick switch or fork.
- **Unmount** (on screen **Close branch**, with **Reopen** on a closed row) takes
  a mount out of the session and keeps its history.
- **Cleanup** deletes the worktree and keeps its local branch. A mount with
  uncommitted work, a lock or a process using the folder is kept and retried at
  the next cleanup.

A turn **starts in** one mount, where it opens its terminal, runs git and shows
its pull request, and it can still write in every mount. The chat header names
the start ("Starts in") and lists the rest of the reach in its tooltip; with two
or more mounts you pick the start there or from a row's menu, and each row shows
the agents working in it. After a turn, Goodboy records which mounts it changed,
so the agent's Activity row names every worktree it changed.

## Storage

**Settings › This Mac › Storage and search** shows every worktree folder Goodboy
made as **In use** (an open session; never touched from here), **To review** (an
archived or deleted session, or none) or **Kept** (kept for good or for 30
days).

- A clean folder idle longer than "Suggest cleanup after" (30 days by default)
  can go in one bulk step; its branch stays, even with unpushed commits.
- A scope picker shows one workspace (the window's, by default), **Removed
  workspaces** (folders whose workspace is gone or never existed) or **All
  workspaces**.
- **Artifacts from deleted sessions** are listed with their saved copy, when the
  session was deleted and when you last used them (the later of the last edit
  and the last open). You can open, keep (30 days or always) or delete one;
  delete removes the copy and the record. One deleted longer ago than "Suggest
  cleanup after" and unused for twice that long is suggested for a bulk delete.
