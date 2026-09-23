# ADR 001: rename workspaces to projects, add workspace containers

> **Read this when** you need why the 0.2.0 schema calls the old workspaces
> table `projects`, or what the m117+ migrations did to existing data.
> **Not for** what the objects mean today ([concepts.md](../concepts.md)) or
> how migrations run ([architecture.md](../architecture.md)).

Status: accepted, shipped in 0.2.0 (migrations m117 through m131).

## Context

Through 0.1.x, the thing you connected was called a workspace, and it was a
leaf. It was one repo, one folder, or a composite that stitched other
workspaces together. So one word had three meanings as a container. Five UI
surfaces each named the kinds differently. The composite feature was bolted on
beside the normal path instead of built into it. The 0.2.0 model wants one
container, the workspace. It owns the profile, the integration bindings, the
projects and the sessions. Sessions are born lazily on the container.

## Decision

Rename instead of adding an alias. The migrations do this:

- `m117` renames the `workspaces` table to `projects`.
- `m118` creates the new `workspaces` container table and moves workflows,
  the step library, skills, sessions and settings onto it.
- `m119` changes each project's kind to `repo` or `folder` (`simple` becomes
  `folder`).
- Later migrations add profiles (m120), per-project session mounts (m121),
  lazy-project session events (m130) and integration bindings (m131).

The rename cannot be undone, by design. Keeping both names, or a view layer
that translated one into the other, would have kept the old words alive in
every query and every new feature.

## Backfill rules (m118)

- An **active composite** became a workspace. Its members became that
  workspace's projects.
- A **disconnected composite** was dissolved. Its row was deleted, and its
  sessions moved to the workspace of its first member.
- Every other leaf was a **dual identity** and was absorbed. The one old row
  became both a workspace container and its single project. The container
  took the leaf's name, root path (as the sessions root) and settings.
- Workspace **slugs** were made from names (lowercased, with non-alphanumerics
  collapsed to dashes). Duplicates got numeric suffixes. Composites won the
  bare slug over their members.
- Live workflow names that clashed inside a merged workspace were renamed
  with numeric suffixes. For clashing skill names, only the most recently
  updated row was kept, since skills are found again from disk. Step library
  rows with no workspace stayed global seeds.

## Consequences

- From m117 on, no 0.1.x build can read the database. The table that 0.1.x
  calls `workspaces` holds projects. There is no in-place downgrade.
- The way back is the snapshot taken before migrating. At boot, pending
  migrations trigger a `VACUUM INTO` snapshot next to the database
  (`data.db.pre-m<next>-from-m<current>-<timestamp>.bak`, two kept) before
  anything runs. If the snapshot fails, the migrations stop
  ([architecture.md](../architecture.md) → Database migrations). Going back
  to 0.1.x means restoring that file.
- Composite workspaces are gone as a feature and live on as the model. Every
  workspace is a container. A single repo is a container with one project.
- Code and docs use one vocabulary. Workspace is the container. Project is
  the leaf, a repo or a folder. `session_worktrees` rows now point at a
  `project_id`, and per-repo state (integration overrides, scripts) hangs
  off projects.
