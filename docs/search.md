# Search

> **Read this when** you change what ⌘F finds, how the local search index is
> kept, or how a hit lands in its view. **Not for** the ⌘K palette (see
> [navigation.md](navigation.md)) or code search inside a repository (the
> editor and the Explore lens).

Search reads one local index in the app's own database. Nothing leaves the
machine: the index holds only text the database already holds, lives in the
same file, and goes with it on backup, restore and wipe.

## The index

m211 adds three tables.

- `search_index` is an FTS5 table with two columns, `title` and `body`. It
  uses the `unicode61` tokenizer with `remove_diacritics 2`, so "Tomas"
  finds "Tomás". Every typed word is a prefix query, so a word typed halfway
  still matches. There is no `prefix` index: on 100k messages it made a two
  letter prefix 15% faster (34 ms to 28 ms) and the index 70% bigger.
- `search_docs` holds one row per indexed object: its `kind`, the id of the
  source row, the ids it hangs from (session, agent, mount, project,
  workspace), its provider, container and status, and the time it
  happened. `fts_rowid` ties it to its `search_index` row. Deleting a doc
  deletes its index row through a trigger.
- `search_index_state` keeps the backfill cursor per source, and
  `search_excluded_projects` the projects left out of search.

| Kind                          | Source                                               | Title            | Body                                                |
| ----------------------------- | ---------------------------------------------------- | ---------------- | --------------------------------------------------- |
| `session`                     | `sessions`                                           | Goal             |                                                     |
| `message`                     | `messages`, user and assistant only                  |                  | Text                                                |
| `agent`                       | `agents`                                             | Name             | Output summary                                      |
| `plan`, `report`, `wireframe` | `session_artifacts`                                  | Title            | Markdown source (a wireframe's JSON is not indexed) |
| `decision`                    | `session_decisions`                                  | Text             | Why                                                 |
| `question`                    | `open_questions`                                     | Question         | Your answer                                         |
| `issue`                       | `session_external_tasks`, `workspace_starred_issues` | Key and title    | Container                                           |
| `pr`                          | `github_pr_cache`, `mount_pr_links`                  | Number and title | Branch and repo                                     |
| `branch`                      | `session_worktrees`                                  | Branch           | Mount name                                          |

Never indexed: tool output (`turn_events`), system messages, terminal
output, settings, credentials and tokens.

### Kept in sync by triggers

Every source table has three triggers, `search_<name>_insert`, `_update` and
`_delete`. So no code path, TypeScript or Rust, can forget to index. An
update trigger fires only on the columns that feed the index. Each trigger
first deletes the doc it is about to write, so an `INSERT OR REPLACE` that
skips the delete trigger still leaves one doc.

A trigger body reads only its own row and the `search_*` tables. It never
reads another source table: a trigger that names a table breaks the
`ALTER TABLE ... RENAME` of that table's next rebuild (see
[traps.md](traps.md#traps-in-the-toolchain)). So a doc stores only what its
own row knows. The workspace of a message, the provider of an agent and the
archived state of a session are joined at query time, which also keeps them
current when they change.

Deletes cascade. `search_docs` has foreign keys to sessions, agents,
mounts, projects and workspaces with `ON DELETE CASCADE`, and the delete
trigger of each source removes its own doc. A tombstoned session or agent
keeps its docs until the tombstone is collected, and the query hides them.

### Backfill

m211 creates the triggers but indexes nothing, so an upgrade never blocks
boot. Rows written before it are filled by `runSearchBackfillStep` in
`packages/db/src/maintenance/searchBackfill.ts`, one batch of 200 rows of one
source per call, in its own transaction. `search_index_state` keeps a cursor
per source (the row id, or the rowid for the three tables without one), so
the backfill resumes where it stopped after a quit or a crash. The batch is
small on purpose: every statement goes through the one database connection,
and a batch of 500 messages held every other write for 180 ms on the 100k
fixture. A doc the
triggers already wrote is skipped, so running it twice changes nothing.

The backfill has its own copy of the per-source columns. The triggers are
frozen in m211 and the backfill is not, so `searchBackfill.test.ts` checks
that a rebuilt index equals the one the triggers wrote, row for row. A
migration that changes a trigger changes the backfill in the same pull
request.

`rebuildSearchIndex` empties the index and the cursors; the next idle steps
refill it. `purgeExcludedSearchDocs` deletes the docs of the projects in
`search_excluded_projects`. A doc belongs to a project when it names it,
when its session's active project is that project, when its session or
mount has a worktree of it, or, for a pull request, when a worktree of it
has the same repo and branch.

## The query

`searchIndex` in `packages/db/src/queries/search.ts` takes a `SearchQuery`
(text, kinds, workspace, session, projects, providers, statuses, a date
range, archived handling and a limit) and returns `SearchHit`s.

- **Words.** The text is folded to lower case without diacritics and split
  on anything that is not a letter or a digit. Each word becomes a prefix
  term and all of them must match, so "pay export" finds "Speed up the
  payout export". An issue key splits the same way: "HAR-231" is "har" and
  "231".
- **Ranking.** `bm25` with the title weighted 4 to 1 over the body, scaled
  by up to 1.5 for recency with a half-life of a week, so the newer of two
  equal matches comes first. With no words, the newest docs of the filters
  come first.
- **What the query joins.** The owner session is the doc's session, the
  session of its mount, or for a cached GitHub pull request the newest
  session with a worktree on its repo and branch. Through it come the
  workspace, the session title and the archived state. The agent comes from
  `live_agents`, and its provider from the agent's run.
- **What it hides.** Tombstoned sessions, agents and workspaces, archived
  sessions and everything in them unless the query asks (`archived:
'only'` is what `is:archived` means), and every doc of an excluded
  project.
- **Marks.** The title comes back highlighted and the body as a snippet of
  about 18 words, both as `MarkedSegment`s. Marks are computed only for the
  rows returned, after ranking.

On the 100k message fixture (`search.perf.test.ts`, Apple silicon), a rare
word answers in 4 ms, two common words in 55 ms, a scoped prefix in 35 ms
and the newest messages of a filter in 40 ms. Indexing costs 0.03 ms per
message written.

### Size

The index keeps its own copy of the text, which `snippet()` needs, plus
positions for every word. On a fixture shaped like a real database (2,343
messages averaging 2 KB, 87 artifacts, 464 short objects, 6.8 MB of text)
it takes 15 MB. `readSearchIndexStatus` reads the real size from `dbstat`.
