# Session Ask turns

> **Read this when** you change how Ask answers a question about one session:
> its scope, the staged session files, the pack it sends, the answer format,
> reveal, Stop or spend. **Not for** the read-only CLI shape it shares with
> the workspace chat ([workspace-chat.md](workspace-chat.md)).

Ask answers a question about one session from the Ask pane beside the page
(`ask.open`, ⌘L) or the field at the foot of the Overview. It reuses the
workspace chat pipeline (same hardening, same `chat_event` channel, same stream
reader) with a session scope: `ask_turn` in
`apps/desktop/src-tauri/src/chat.rs`.

## Scope comes from the database

The frontend sends the thread id, the session id, provider, model, effort, the
prompt and the session files.

- Rust reads the provider from the thread row (`chats.session_id` must be that
  session).
- It reads the session's attached worktrees from `session_worktrees` (oldest
  parallel index first).
- Missing folders, `/`, the home folder and its parents are dropped, as for
  Chat.

## The session files

The frontend stages at most 40 Markdown files and 512 KiB (agent transcript
tails).

- Names are one or two plain segments ending in `.md`, never hidden, never
  `..`.
- Rust writes them owner-only and read-only into `goodboy-ask/<run id>/` in the
  system temp folder, and removes the folder when the turn ends or fails to
  start.
- The prompt ends with the list of staged files and the worktree paths.

## Per provider

| Provider             | Working folder                         | Reads                                                                                  |
| -------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Claude               | The first worktree                     | The other worktrees and the staged folder as `--add-dir` roots                         |
| Codex 0.160.0 and up | The first worktree                     | The worktrees and the staged folder as its permission profile's read roots             |
| Older Codex          | The staged folder, with `-s read-only` | The worktrees by the absolute paths in the prompt (the known limit described for Chat) |

A session with no worktree runs inside the staged folder with either provider,
so Ask works without a connected project. Both pass the same argument check as
Chat (`assert_read_only`), and the Rust tests pin each provider's arguments.

## The pack

`features/session/ask/buildAskPack.ts` is a pure builder over what
`collectAskPackInput` reads from the store. It holds:

- Right now.
- Live work (`askLiveOf`): the last 10 tool calls of each running agent,
  every check with its result, each worktree's state and each script run with
  the end of its output, kept under `ASK_LIVE_BUDGET_TOKENS` (4,000 tokens).
- Goal and agents.
- Open questions and the last 3 answered ones.
- Runs: running plus the last 2 finished.
- Review comments by word, with every Needs you and Couldn't fix item.
- Branch and pull request, artifacts.
- The last 20 events that are not decision changes.
- Decisions and summary.

### Budgets

- Every object gets a handle (`A1`, `R1`, `Q1`, `C1`, `PR`, `D1`).
- Live agents keep up to 2,000 characters of their summary, settled ones 280,
  and only the 15 newest settled agents are listed.
- The whole pack stops at 48,000 characters, about 12 thousand tokens.
- Agent transcript tails (the newest 6,000 characters, at most 8 agents) go to
  `agents/<handle>.md` as staged files, never inline.
- The finished pack and every staged file pass `redactSecrets` last, so no
  field skips it.

The prompt is the pack, then the thread's last 12 messages (at most 24 thousand
characters, as Chat), then the question.

## The answer

`buildAskSystemPrompt` asks for:

- One bold sentence.
- Handles in double brackets (`[[A2]]`, `[[webhook.ts:88]]`).
- The app's state words.
- At most one `<<suggest target="Q1">>…<</suggest>>` line for a question or an
  agent.

`parseAskAnswer` turns known handles into chips, shows an unknown one as plain
text and hides a marker still streaming. When the answer ends,
`stabilizeAskAnswer` rewrites handles as stable references
(`[[agent:<id>|Implementer]]`) before the message is saved, so chips work after
a restart without the pack.

## Reveal and Stop

`sendAskQuestion` marks the reply live by message id on each delta and flushes
it when the answer fails or is stopped. `AskTurn` parses only the revealed
prefix, and the actions and footer wait for the reveal to end
([text-reveal.md](text-reveal.md)).

Stop is latched from the moment the reply shows as streaming.
`sendAskQuestion` checks it after saving the two messages and never launches
the CLI, and a Stop that lands while `ask_turn` is spawning cancels again once
the spawn returns (`onStarted`). The reply ends stopped either way.

## Spend

A usage event from the stream inserts a `provider_runs` row and a telemetry
record of kind `ask` on the session (`recordAskUsage` through
`recordUsageTelemetry`), which emits the budget alerts like a turn. The
answer's cost stays in memory for its footer.

## Storage and mock

- Threads are `chats` rows with `session_id` set, and messages are
  `chat_messages` (`insertAskThread`, `listAskThreads`). A model change updates
  the thread row.
- With `VITE_GOODBOY_MOCK=1` the slice runs on an in-memory backend with a
  scripted responder, and
  `?scene=session-ask&state=closed|rightnow|streaming|answer|followup|plan`
  shows each state.
