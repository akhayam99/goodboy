# Glossary

Canonical term definitions for kAY.am. Use these in code, UI, docs, and issues.

| Term                | Definition                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **workspace**       | A registered repository directory. The root git repo kAY.am tracks and creates sessions inside.                                                           |
| **session**         | A goal-oriented conversation inside a workspace, tracked from start to end. Each session gets its own worktree and branch.                                |
| **phase**           | A named stage inside a session (e.g. planner, coder, reviewer). Phases are declared in a phase template and executed in order.                            |
| **run**             | An execution instance of a phase. One phase can produce multiple runs (e.g. retries or parallel fan-out).                                                 |
| **parallel group**  | Multiple phase runs executing in parallel on throwaway worktrees, merged back at completion.                                                              |
| **worktree**        | The git worktree directory for a session — the path on disk where files live during that session. Removed when the session ends; the branch is preserved. |
| **branch**          | The git branch the worktree checks out. Named `<prefix>/<slug>` by default. Preserved after session ends for manual review or merge.                      |
| **skill**           | A markdown + scripts automation invocable from chat via `/skill-name`. Stored locally, provider-agnostic.                                                 |
| **permission rule** | A matcher pattern for tool-call interception. Determines whether a tool invocation is allowed, denied, or requires confirmation.                          |
| **turn**            | One user prompt → one assistant response, including all streaming events in between. The atomic unit of interaction within a session.                     |
