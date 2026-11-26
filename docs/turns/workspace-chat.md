# Workspace chat turns

> **Read this when** you change how a workspace chat asks a provider a
> question without a session: the read-only CLI shape, its images, channel,
> storage, default model, activity marks or Start work from chat. **Not for**
> the session Ask that reuses this pipeline ([session-ask.md](session-ask.md)).

A workspace chat asks the provider a question without a session, an agent or a
worktree. `apps/desktop/src/store/slices/chats/` drives it,
`apps/desktop/src/features/conversation/streamChatTurn.ts` reads the stream,
and `apps/desktop/src-tauri/src/chat.rs` spawns the CLI.

## Always read-only, Claude or Codex only

`chat_turn` reuses the session turn's argument builder but pins the read-only
shape. The frontend sends only the chat id, provider, model, effort and text.
Unknown fields are refused, model and effort must match `[A-Za-z0-9._:-]` with
no leading dash, the provider must match the chat row, and Rust resolves the
binary from the provider's own CLI name. A check on the final argument list
refuses any write flag before the prompt and any missing read-only flag.

### Claude

- `--restricted`: file tools confined to the chat folders, no user, project or
  local settings.
- `--setting-sources ""`, `--settings {"disableAllHooks":true}`, and
  `--strict-mcp-config` with an empty `--mcp-config`.
- Plan mode, only Read, Grep and Glob, no session persistence.
- A deny list for secrets such as `~/.ssh`, `~/.aws`, `~/.config`,
  `~/.goodboy`, `~/.claude`, `~/.codex`, keychains and `.env` files.
- The question goes after `--`, so a question that looks like a flag stays
  text.

### Codex

Codex runs with `--ignore-user-config`, `--ignore-rules`, `--ephemeral` and
`-c mcp_servers={}`. Rust picks the sandbox from the `codex --version` that
`cli_probe::version_cached` keeps per file.

**0.160.0 and newer** get a permission profile and no `-s` flag:
`-c default_permissions="goodboy-ask"` and one inline table
`-c permissions.goodboy-ask.filesystem={":minimal"="read","<root>"="read",...}`
that lists every read root (Chat: the workspace projects and the staged image
folder; Ask: the session worktrees and the staged session files). Codex reads
only those roots, writes nothing and has no network.

- `-s read-only` would override the profile and open the whole disk, so the
  argument check refuses any `-s` next to the profile and any `"write"` grant.
- The table must be one value: a dotted key per path keeps the quotes and
  fails with "must be absolute".
- Paths are canonical (symlinks resolved) and quoted as TOML strings.
- `":minimal"` is required or the shell cannot start. It also allows the
  system temp folders, so temp is never private.

**Older or unknown versions** get `-s read-only`. This is a known limit: Codex
can read any file your user can read, though writes and network stay blocked.
Upgrade Codex, or pick Claude, for a chat that must not look outside its
folders.

### Other providers

Cursor, Gemini, Copilot, opencode, OpenRouter and Moonshot are refused with
"Chat needs a provider that can run read-only: Claude or Codex". The schema
keeps `chats.provider` to `anthropic` and `codex`, and `CHAT_PROVIDER_IDS` in
`@goodboy/types` lists them for the model picker.

## Where it reads

Rust reads the chat's connected projects from the database by chat id. The CLI
runs in the first project (oldest first), and the others are extra read roots
for Claude and for Codex 0.160.0 and newer. It never widens to a shared parent
folder, and never uses `/`, the home folder or a parent of it.

## Images

The composer takes up to 10 PNG, JPEG, GIF or WebP images per message, at most
10 MB each.

1. Before the message is saved, `chat_attachment_write` stores each one
   read-only in the app's `chat-attachments/<chat id>/` folder. The message and
   its `chat_message_attachments` rows go in one transaction. A failed write
   sends nothing and puts the text and images back in the box.
2. The frontend then sends only `images: true` and the message id, never a
   path. Rust hard links (or copies) the chat's images into a fresh root,
   `goodboy-chat/<run id>/` in the system temp folder: folder `0500`, files
   `0400`, the `goodboy-chat` folder `0700`.
3. Rust removes the root when the turn ends or staging fails. A root a crash
   left behind is swept at startup (`proc::reap::sweep_stale_turn_dirs`, six
   hours old).

Per provider:

- Claude gets the root as one more `--add-dir`, never as the working folder
  and never when it sits inside a project. The prompt ends with the image
  paths, the new message's marked "(this message)". `~/.goodboy` stays denied,
  so the agent never reads the store itself.
- Codex gets the new message's images with `--image`.
- Earlier messages name their images in the history text.

Cleanup and display:

- Deleting a chat removes its folder (`chat_attachments_remove`).
- A bulk drop of chats (a deleted or merged workspace, a wiped database, a
  hygiene pass) leaves folders with no `chats` row. `chat_attachments_prune`
  removes those after a merge, after a wipe and at every boot.
- The thread loads each image through `chat_attachment_read` as an object URL
  freed on unmount, and a user message is memoized, so a streaming answer
  redraws only itself.
- `chat.images` set to `false` is the kill switch: no paperclip, no paste, no
  image root on any turn.

## Its own channel

Output streams as `chat_event` with the chat id, never as `turn_event`, so no
session sees it. There is no reload backlog: a reply still streaming when the
window closes is marked stopped at the next load, and a load whose pass fails
leaves it to the next one.

A reply is done only when the stream reports no failure and the CLI exits with 0. Anything else keeps the partial text and marks the reply failed, with the
error under it.

## What it carries

Each turn sends the workspace system prompt and the last turns of the chat as
text: Goodboy owns the conversation, not the CLI. The files a read tool opened
are kept on the reply for the "Read N files" trace. Codex reads through shell
commands, so its trace takes the file arguments of common read commands
(`chatReadPath.ts`).

## Storage

The tables are `chats`, `chat_messages`, `chat_session_links` and
`chat_message_attachments`.

- A chat stores its model as a catalog key and, once the user sets one, an
  `effort` that overrides the effort the key implies.
- Every assistant message records the `provider`, `model` and `effort` that
  produced it.
- `ChatSummary.modelsUsed` (distinct pairs, oldest first) and
  `ChatSummary.messageCount` come from one grouped read in `listChats`, so the
  list costs a single scan.
- `chat_session_links` saves each Start work from chat or Add to a session
  (`new` or `add`, the chat, the session, the message).
- Deleting a chat deletes its messages and links, never its sessions. Deleting
  a session deletes its links.
- Idle is derived: seven days without activity moves a chat to the idle group.
  Only the user archives it.

## Default model for new chats

Without a saved default, a new chat starts on the newest Sonnet when Claude is
connected, else the newest GPT Sol when Codex is (`defaultChatModel`, through
`latestInGroup`), never above the mid cost tier. A connected workspace default
provider that can run a chat wins; a Cursor or OpenCode default never reaches a
chat.

A saved default (provider, model, effort) lives per workspace in `settings`
under `chat.default_model.<workspaceId>` (JSON; an empty string means
cleared). It is set from Providers, Models, Chat, or with Make default in the
chat model picker. Picking Claude in Providers, Models, Chat proposes the same
model.

- `defaultChatRouting` applies it to the draft in `ChatRoom`; `askInChat`
  applies it to Ask in Chat.
- A value that fails `parseChatDefaultModel`, or whose provider is not
  connected, falls back to the automatic model.
- An existing chat keeps the model stored on its row.
- The first send of a new chat awaits the saved default
  (`useChatDefaultModel` `read`), so a cold cache never starts it on the
  automatic model. A failed read is reported and falls back.
- Reset all in Models clears it with the role and task pins.

## Activity marks

`chatStreams` says which chats are answering, and `useChatActivity` turns it
into the top bar mark: "1 chat running" while any reply streams, else "New
reply" while any chat is unread. Each chat row leads with a `StateNode`
(`chatNodeOf`), which gives its slot to the selection checkbox on hover, focus
and while any chat is selected (`isCheckboxSlot`). Space on a focused row
toggles it (Shift extends the range).

A chat becomes unread when its reply ends, done or failed, while the studio is
not showing it; a reply the user stopped never does. Opening or archiving it
clears the mark. `unreadChatIds` is saved in `localStorage` (`chat-unread:v1`),
so it survives a reload without a migration.

## Start work from chat

The button under a finished answer drafts a brief (title, goal, what we know,
files, projects) with one `summarize_session` call through `runAuxOneShot`,
with no tools and no working folder (`summarizeChatForWork.ts`).

- **Drafted by** is a `RoutingPicker` pill limited to chat providers, with no
  effort (`isEffortHidden`). It defaults to the chat's model and is remembered
  per workspace in `chat.workDrafter.<workspaceId>` (`workDrafter.ts`).
  Changing it drafts again and drops hand edits.
- The model must answer one JSON object. Anything else, a failure or 45
  seconds without an answer falls back to a brief from the last answer
  (`draftWorkBrief`).

**Start session** creates the session with the title, the goal (the brief
goal, then "What we know" and "Files" as short lists) and the picked projects,
with no first agent and no kickoff. It records a `new` link and opens **Start a
run** on the session's Runs with the brief as its text (`openStartRun`),
routed like any ask; there is no Runs on choice. The panel starts on the
keyboard with cmd or ctrl plus Enter.

**Add to a session** sends no turn: it records an `add` link and opens the same
field in that session with the title and brief.

The Project field (`ProjectField.tsx`) is a searchable multiple `Listbox` with
removable chips and a "No folder" state, and hides in "Add to a session" mode.
It starts with the projects the answer named files in, or none; the first pick is `createSession`'s `projectId`, the others
`additionalProjectIds`. The Session field (`SessionField.tsx`) lists Active,
then Recent sessions.

## Under the hood

- The Rust tests in `chat.rs` pin the read-only argument shapes.
- `ChatThread.redraw.test.tsx` (50 images) proves a streaming answer redraws
  only itself.
- `VITE_GOODBOY_MOCK=1` runs the slice on an in-memory backend with Harborline
  chats and a fake responder; `?scene=chat-room` takes
  `work=drawer|project|add|session`, `chat=<key>` (`retry` drafts two projects)
  and `activity=running|unread|mixed`, and `r4-chatlist-*` scenes show the row nodes.
