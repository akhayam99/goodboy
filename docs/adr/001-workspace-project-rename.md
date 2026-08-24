# ADR 001: rename workspaces to projects, add workspace containers

> **Read this when** you need why the 0.2.0 schema calls the old workspaces
> table `projects`, or what the m117+ migrations did to existing data.
> **Not for** what the objects mean today ([concepts.md](../concepts.md)) or
> how migrations run ([architecture.md](../architecture.md)).

Status: accepted, shipped in 0.2.0 (migrations m117 through m131).

## Context

Through 0.1.x the unit you connected was called a workspace, and it was a
leaf: one repo, one folder, or a composite stitching other workspaces
together. That gave the product three container semantics for one word, five
UI surfaces each naming the kinds differently, and a composite feature bolted
beside the normal path instead of under it. The 0.2.0 model wants one
container (workspace) owning profile, integration bindings, projects and
sessions, with sessions born lazily on the container.

## Decision

Rename rather than alias. `m117` renames the `workspaces` table to
`projects`; `m118` creates the new `workspaces` container table and rewires
workflows, step library, skills, sessions and settings onto it; `m119`
retypes projects to kind `repo` or `folder` (`simple` becomes `folder`);
later migrations add profiles (m120), per-project session mounts (m121),
lazy-project session events (m130) and integration bindings (m131).

The rename is irreversible by design. Carrying both names, or a view layer
translating one into the other, would have kept the old vocabulary alive in
every query and every new feature.

## Backfill rules (m118)

- An **active composite** became a workspace; its members became that
  workspace's projects.
- A **disconnected composite** dissolved: its row was deleted, and its
  sessions moved to the workspace of its first member.
- Every other leaf was a **dual identity** and was absorbed: the one old row
  became a workspace container and its single project, the container
  inheriting the leaf's name, root path (as the sessions root) and settings.
- Workspace **slugs** were derived from names (lowercased, non-alphanumerics
  collapsed to dashes) and deduplicated with numeric suffixes, composites
  winning the bare slug over their members.
- Live workflow names that collided inside a merged workspace were renamed
  with numeric suffixes; colliding skill names kept only the most recently
  updated row, since skills are re-discovered from disk. Step library rows
  with no workspace stayed global seeds.

## Consequences

- From m117 the database is unreadable by any 0.1.x build: the table that
  0.1.x calls `workspaces` holds projects. There is no in-place downgrade.
- The rollback path is the pre-migration snapshot: at boot, pending
  migrations trigger a `VACUUM INTO` snapshot next to the database
  (`data.db.pre-m<version>-<timestamp>.bak`, two kept) before anything runs,
  and a failed snapshot aborts the migrations
  ([architecture.md](../architecture.md) → Database migrations). Going back
  to 0.1.x means restoring that file.
- Composite workspaces are gone as a feature and absorbed as the model:
  every workspace is a container, a single repo is a container with one
  project.
- Code and docs use one vocabulary: workspace is the container, project is
  the repo-or-folder leaf. `session_worktrees` rows now point at a
  `project_id`, and per-repo state (integration overrides, scripts) hangs
  off projects.
