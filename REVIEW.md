# REVIEW.md

> **Read this when** you review a change here, human, Copilot or agent.
> **Not for** the rules themselves: the rules card in [AGENTS.md](./AGENTS.md)
> owns them.

Mechanical rules have guards; a reviewer who finds one names the guard that missed it.

Hunt these classes first. They are the ones a test and a lint cannot see.

- **Target identity.** A write names its workspace, project, mount or session. Look for a write that reads "the current one" after an await, a cache key that leaves out the project, and a second window that acts on the first one's selection.
- **Commit after confirm.** State changes only after the async step succeeded. Look for an optimistic update with no rollback, a form that closes before the save returns, and a failure that leaves the UI in the new state.
- **Retry and undo.** Every failure shows an error with a way forward, and every restorable action has Undo. Look for a catch that swallows, a retry that repeats a side effect, and an undo that restores only part of the change.
- **Every host.** GitHub, GitLab and Bitbucket each behave differently. Look for a field, status or URL shape written for one host and assumed for all.
- **Stale response.** Only the latest answer wins. Look for a request whose reply lands after the user moved on, and a list that renders a result for a query that changed.
- **Derived values.** Every number on screen comes from one function. Look for a count, total or duration computed twice, in two places that can disagree.
- **Renames in `aria`.** A rename moves every copy of the name: `aria-label`, tooltip, tests that query by accessible name, docs and `FEATURES.md`.
- **Untrusted input.** Look for a regex that can backtrack polynomially on input, a dispatch on a key the user controls, and a path or URL built from user text.

A review unit is at most 15k changed lines of hand-written code. Generated files, baselines and images are marked `linguist-generated` in `.gitattributes` and do not count. A larger release lands in parts, one pull request per wave.
