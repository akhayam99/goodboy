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
- **Paths inside a root.** A Tauri command that reads or deletes a file under a root goes through `util/scoped_path.rs` (`resolve_within`, `open_within`), never a second `contains("..")` or `starts_with` check. Look for a root the window names instead of one the command finds in state, a `canonicalize` followed by a plain `File::open`, a delete that follows a symlinked parent, and a read of an absolute path the user never dropped.
- **Untrusted input.** Look for a regex that can backtrack polynomially on input, a dispatch on a key the user controls, and a path or URL built from user text.

For a change a user can see, also apply [DESIGN.md](./DESIGN.md) → One frame for every page:

- **Back and crumbs.** A page below a session tab shows the head's back button and the crumbs, and the first crumb reads Overview. Look for a second `Back to` row, a trail on a session page, or a back glyph outside the head and the drawer frame (`every-place-has-a-way-up`, `no-back-glyph-in-trail`).
- **One left edge.** The head, crumbs, page header and content start at one x and sit in one `PageColumn` width tier from `PAGE_MEASURE`. Look for a page with its own `max-w`, its own centring, or a title in big type under the tabs (`app/components/StudioFrame/columnContract.test.ts`).
- **One filled button.** A row and a header hold at most one filled button, and an intent comes from `actionIntentOf` or `actionButtonLookOf`. Look for a hand-picked tone on a Rebase, Reset, Discard, Delete or Stop (`toned-verbs-take-their-intent`).
- **Action names.** A label is a verb and an object in the developer's words, and a copy action exists only where the content is not selectable (`action-labels-say-what-they-do`).
- **No raw ids or internal words.** Look for an artifact id, a worktree id, a task prompt or an exception message on screen (`jargon-copy`).
- **State words from one function.** A run, an agent or a row says its state once, from the function that owns it (`boardRowCellsOf`, `autoTreeWordOf`, `state-words`). Look for the same state in two cells, or two words for one thing.
- **Panels and menus.** Panels follow the one push or overlay rule, and a page, row or panel has one `⋯` of five rows or fewer (`menu-row-budget`).
- **Before and after.** The main visible changes of a release carry before and after pictures, light and dark ([docs/release-command.md](./docs/release-command.md)). Look for a visible change with no pair.

A review unit is at most 15k changed lines of hand-written code. Generated files, baselines and images are marked `linguist-generated` in `.gitattributes` and do not count. A larger release lands in parts, one pull request per wave.
