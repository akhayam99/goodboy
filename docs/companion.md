# Companion bridge

> **Read this when** you are changing how a phone pairs with the desktop, what
> a paired phone may ask for, or when the pairing listener runs. **Not for**
> the phone app itself (its wire contract is `PROTOCOL.md` in the mobile
> repository) or the data disclosure users read (`SECURITY.md`).

Goodboy for iPhone talks to a running desktop over the local network. The
desktop side is the Rust module `apps/desktop/src-tauri/src/bridge/` plus the
frontend executor in `apps/desktop/src/features/companion/`. The Noise
parameters, the opcodes and the token lifetime are fixed by the mobile
contract; the pairing hello and the QR carry a protocol version, and a change
to either raises it. The desktop refuses a phone that speaks an older version.

## The invariant

**Pairing a phone grants it rights on this machine, and you choose them per
phone.** Every paired phone reads sessions. By default it may also reply and
approve (send a message, advance a step, resolve a comment, set a context
slot) and merge pull requests. Starting sessions (spawn an agent or a workflow,
create a session from an issue) is off until you switch it on for that phone.
A session the phone starts with the start action runs with the Edits level it
chose, Read only, Ask first or Edits allowed, never with permissions bypassed.
A session started the older way (spawn, create from an issue) runs with
permissions bypassed, and so does any session a phone may message, so a phone
that may send or start can end in any command the agent chooses to run. Treat a paired
phone with those rights like a second keyboard, not like a viewer.

## Pairing

- The desktop keeps a long-term Noise static key and one record per paired
  phone in `~/.goodboy/companion.json`: its key, the name it gave, when it
  paired, when it was last seen and its rights. It never leaves the machine.
  A file written by an older version holds a bare list of keys: each becomes a
  record with the default rights and is written back in the new shape.
- Settings, iPhone mints a one-time 256-bit token that expires after 60
  seconds and shows it with the desktop's key and addresses as a QR code. The
  payload has `v: 2`, the device name, the key, the token, the endpoints, the
  service name and the rights a new phone gets, so the phone can list them
  before it pairs. A phone that completes the Noise XK handshake with a live
  token is added and the token is burned. A known key reconnects without a
  token.
- The phone opens the handshake with a version 2 hello: the version byte, a
  flag for a token, the token when there is one, and its name in a fixed 64
  byte field (66 or 98 bytes, never 0 or 32, which are version 1 payloads).
- A refusal is a frame the phone can show (opcode `0x0E`): `protocol_unsupported`
  for a hello that is not version 2 (a version 1 phone, or a newer one),
  `not_paired` for a key the desktop does not know, and `token_invalid` for a
  token that was used or has expired. A version refusal does not burn the
  pairing code and does not count against the sender.
- Disconnect on Settings, iPhone clears every phone and drops every live
  connection; each phone must scan a new code to come back. Disconnect on one
  phone's row forgets that phone alone, and a live connection of it ends
  within one ping (20 seconds); its rights go at once. The row shows when the
  phone was last seen. A phone can never re-pair itself.

## Rights per phone

| Right  | Allows                                                                   | Default   |
| ------ | ------------------------------------------------------------------------ | --------- |
| read   | the projections and the read-only queries (providers, issues, file diff) | always on |
| decide | send, advance step, resolve comment, set context slot                    | on        |
| merge  | merge a pull request, merge in order, stop the train after this one      | on        |
| start  | start a session, spawn agent, spawn workflow, create session from issue  | off       |

The bridge checks the right of the phone that sent the command, read from the
file at that moment, so a change on Settings, iPhone applies to a connected
phone at once. A command the phone may not run is answered with
`permission_denied` and the right it lacks; nothing reaches the executor. The
hello the desktop sends after the handshake carries the phone's rights.

## What a phone may ask

The phone requests only a closed set of actions, decoded from fixed opcodes.
It never supplies an origin, a path, a working directory, or tool or
permission flags. The bridge stamps every command `mobile` from the channel it
arrived on and forwards it to the desktop frontend, which is the trusted gate:
it checks scope and runs the same store actions the desktop UI uses. There is
no raw or exec action. Merge policy lives in the frontend executor, not in the
bridge.

A phone merge (`mergePr`, opcode 0x9E; the older 0x8A runs the same checked
path) carries the Mac's action id, the pull request number, the head the phone
saw, the method and a switch to delete the branch. The Mac refuses a head that
moved, naming both heads, and refuses a pull request that is not on that
session. The branch is deleted only after a merge that landed and only when the
switch is on, through the same after-merge cleanup the desktop runs. A phone
merge follows the desktop merge readiness rule and is stricter about
it: what blocks the desktop blocks the phone, and so do the desktop's warnings
(changes requested, a review still requested, failing or running checks) and a
mergeability GitHub has not finished computing. The phone shows a fraction of
the context and a merge cannot be undone, so the phone refuses with the same
reason the desktop would show. A repository with no required review or no CI
merges from the phone like it does on the desktop.

### Merge in order and start a session

Two more actions follow the same five rules, written in
`features/companion/actions/` (`executePhoneAction.ts`):

- `mergeTrain` (0x9F) carries the exact list the phone saw: for each pull
  request its session, number and head. The Mac checks every entry with the
  phone merge rule and its head before anything merges, and refuses the whole
  request on the first entry that fails, naming it. It starts the desktop's
  train (`startMergeTrain`, squash by default) and answers at once; the train
  runs for minutes and its progress comes through the projection. One train runs
  at a time: a second request is refused as `busy`. The train stops at the first
  pull request it cannot merge and says why, and a conflict goes to the Lead.
  Its action id holds a digest of the list and a counter of trains already
  started, so a retry of the same request is replayed and the next train gets a
  new id.
- `stopTrain` (0xA1) asks the running train to stop after the pull request in
  progress (`stopMergeTrainAfterThis`). Both need the merge right.
- `startSession` (0xA0) needs the start right, off by default. It carries the
  project, a goal or a task, the Edits choice (Read only, Ask first or Edits
  allowed; Full access is not a value the Mac accepts), the kind (Lead, Lead
  with a plan of the workspace, or Agent · Scout) and, for a Lead, a limit among
  the amounts the Mac offers and Stops (Every step, After the plan or Never, the
  desktop start form's choice, applied as the run's level). A phone that sends
  no Stops leaves the level to the Mac, and Stops on an Agent · Scout is
  refused as `invalid-request`. The Mac sets the session's permission mode before
  the first agent starts, so a phone-started session never runs with
  permissions bypassed. It limits starts to 5 a minute and 10 a day across all
  phones and a goal to 2,000 characters. Its id holds a counter of starts, so a
  retry with the same id returns the first outcome and the session it made, and
  a start that fails after the session exists deletes it. The outcome carries
  `createdSessionId` so the phone can follow it.

The `sessions` projection carries the train offer: the ready pull requests in
the desktop order (`mergeOrderOf`) with the head of each, the line "Squash and
merge, smallest change first", and, while a train exists, its status (phase,
index, merged count, the desktop line, one line per pull request, the reason it
stopped, whether the Lead has the conflict, whether a stop was requested). The
`pullRequest` projection repeats it for a session that is in the train, and adds
the changed files count, the commit count and the open review comments. It adds
the lines added and deleted only when every changed file is known to the Mac;
otherwise both stay absent, never 0. The `session` projection carries the
summary of the last output, cut to 600 characters. The `tasks` projection
carries the start offer (the kinds that take Stops, the three Stops with their
words and the default one, which is the workspace level) and, for each task row,
the description (400 characters at most), the assignee's display name and the
tracker state, read from the issue the Mac holds for that task and absent when
it holds none. The `isPermitted` flag of the offer
only says the Mac offers the action: the right of the phone that asks comes in
its hello and is checked in the bridge.

### Decisions from the phone

A phone may also answer a question, approve a plan or ask for changes, allow or
deny one permission request once, raise a limit, stop or continue a run or an
agent, stop a Lead with all its running agents in one action (`stopAgentTree`),
send a message to one agent (`sendToAgent`), and send or discard a Slack reply
draft. Always allow, permission rules
and every other setting stay on the Mac. Each of these actions follows five
rules, kept in `features/companion/actions/`:

- It names its target and the version the phone saw: the question text, the
  plan version, the hash of the tool and its input, the limit, the run or agent
  state, the draft. The Mac compares and refuses with a code, a message and the
  list of what changed. A stop or continue that already holds is a no-op.
- The action id is `act:<kind>:<objectId>:<version>`, built by the Mac in the
  projection that offers the action, so a retry reuses it. The executor
  recomputes it from the action's own fields and refuses an id that differs, and
  checks the phone's scope and the session before it looks at stored outcomes. It
  keeps the last 500 finished outcomes and answers a repeated id with the first
  outcome and `isReplay: true`. An id that is still running is refused as a
  duplicate. A failed action is not kept, so a retry with the same id runs again.
  A stop or continue is never kept: its id repeats whenever the state repeats, so
  it runs again and a no-op answers `done`. A raise or an undo is replayed only
  while the limit still shows its result.
- Each action has its own rate limit per minute and a text cap of 4,000
  characters. A limit is raised only to an amount the Mac offered (the current
  limit plus 5, plus 10 or doubled, never above $500), and a raise can be undone
  once while the limit is still the raised one. The limit is the one the named
  target hit: the run's own spend limit, an Auto tree's cap, or the session
  budget, whichever is lowest. A raise and an undo of one session never run at
  the same time. A run stopped at its spending limit reads as paused.
- A stop of a run keeps its steps: it is the desktop Stop (`stopWorkflowRunNow`),
  so Continue resumes it. Sending a Slack reply posts it to the draft's thread
  first and marks it sent only after Slack accepted it; a retry after a failed
  save does not post twice. An answer, a permission or a plan approval whose
  delivery to the agent failed after the decision was saved is delivered again by
  the retry, without saving it twice. A transcript page is cut from the whole
  history, and absolute paths in any text are reduced to the file name.
- The bridge guards the same id before the frontend sees it. A decide action
  must carry an id in the Mac format, its correlation id is the action id, and
  an id already running is refused as `action_in_flight`. The Mac stamps the
  phone's id from its Noise key into every command, over anything the phone
  sent, and never uses a phone-chosen key to wait for the answer. Queries and
  the v1 `send` keep a phone-made correlation id, which the result echoes.
- A message to an agent (`sendToAgent`) uses a counter of the messages the Mac
  already accepted for that agent as its version, so the second message gets a
  new id and a repeated one is replayed, never sent twice.
- The phone needs the permission to decide. The check reads one scope function
  (`phoneScope.ts`) that allows every phone until the pairing settings register
  their own reader.
- The same store action runs as on the desktop: a permission goes through
  Allow and continue or Deny, a plan through the Lead approval, a stop through
  the confirmed stop of the turn.

A decision the phone is offered carries what it needs to answer without
guessing: the options of a question, the steps and touched files of a plan, the
line that stopped an agent, the amounts the Mac offers for a limit, the draft of
a Slack reply, and for a run that waits the id that continues it. A run and an
agent row carry the ids of their own stop and continue, and the Lead row the id
that stops the whole tree. Every one of these ids goes through
`expectedActionIdOf` in a test.

The phone reads one agent's conversation on request: words as text, each tool as
one short line with the file name and the changed line counts, never a diff and
never an absolute path.

An action of an older phone that is not in the contract (`advanceStep`,
`spawnAgent`, `resolveComment`, `setContextSlot`, `spawnWorkflow`) still runs
for a v1 phone and has no v2 counterpart; `send` and `createSessionFromIssue`
stay until the phone ships the start form.

## Listener lifetime

- Nothing listens at boot. The listener starts when Settings, iPhone opens.
  Leaving the page with no phone paired stops it; with at least one phone
  paired it stays up so that phone can reconnect, until the app quits or
  Disconnect runs.
- It binds a random TCP port on the private addresses of the interfaces you
  switch on under Networks, and on no other address. A private address is
  RFC 1918 (10/8, 172.16/12, 192.168/16), 100.64/10 (tailnets) or an IPv6
  unique local address (fc00::/7). A public IPv4, a global IPv6, a link-local
  or a loopback address is never offered in the QR and never bound, even on an
  interface you switched on. Until you choose, every private interface is on.
  Changing the choice restarts the listener and mints a new code. With no
  private network on, the code cannot be made and the page says so.
- Before a phone is authenticated the listener holds at most 8 connections,
  and at most 2 from one source address, so one holder behind a shared address
  cannot block the rest. After two failed handshakes from a source, its next
  attempts wait 2 seconds, then 4, doubling up to 5 minutes; a good handshake
  clears the wait. When 30 handshakes fail within a minute, from any sources,
  new connections are closed for 30 seconds. A connection that closes before it
  authenticates counts as a failure. The whole Noise handshake has 10 seconds,
  then the socket is dropped and the slot frees.
- A connected phone that sends no frame for 60 seconds (three missed pings) is
  dropped; any frame, a PONG included, counts as an answer.

## What the phone sees

The phone gets projections, not database rows. The main window of the desktop
builds them in `features/companion/projections/` with the functions that draw
the same screens (`needsYouOf`, `sessionMarkOf`, `attentionWordsOf`) and
publishes them through `bridge_publish`, a command that refuses every window
but `main`. The Rust side in `bridge/publish.rs` is the border: it parses each
projection against a closed schema (`bridge/publish_schema.rs`), drops fields
the schema does not name, refuses a value outside the vocabulary, a string that
reads as an absolute path and a projection over 56,000 bytes, and cuts lists to
a fixed length (60 moves, 30 sessions per lane, 20 lines, 20 runs, 40 tasks).
A workspace is sent by its name only, a project by its name, never a path.
Free text that can hold a path (a command, a plan step, a draft) is cut to a
length and has every absolute path reduced to its file name before it is sent.
The Needs you projection also carries today's spend and the left share of each
connected plan, from the same functions as the desktop chips. A
projection holds no archived or deleted session, and none of the transcript.

Only what changed is sent: the phone gets one frame per changed projection
(`0x0B`), a frame when one disappears (`0x0D`), a refusal of the handshake
(`0x0E`), and everything again when it
asks (`0x82`). The other workspaces are read by a read-only loader that never
writes the store; for them the sessions, agents, open questions and tasks come
from the database, with the pull request each session last saw, the summary of
its last output and the workspace level. A pull request of a workspace that is
not open shows its state and is never mergeable from the phone (the reason says
to open the workspace on the Mac); its checks, files and line counts are not
loaded. Mounts and project names are not loaded either. Plans,
permission asks, limits and Slack drafts of another workspace are not loaded
either, so only the current workspace's rows carry those decisions. The Mac
reads the transcript of a blocked agent in the background, so the permission ask
appears a moment after the agent blocks.

While the main window is open it publishes at least every four seconds. When no
call reached the bridge for 10 seconds (the window reloaded or closed) the
phone gets `0x0C` with `isOpen: false` and draws "Goodboy is not open on your
Mac" instead of old data. A reloaded window starts a new `epoch`: the bridge
drops what the old one published and refuses a call from the older one.

A `send` that names an `agentId` must name an agent of that session. The
executor refuses an id longer than 64 characters, a non-string, and an id the
session does not hold, before any turn starts. Resolver agents are not in the
session's agent list, so the phone cannot address them.

## The mobile contract

`apps/desktop/src/features/companion/contract/` holds the types of protocol v2:
the six projections (`needsYou`, `sessions`, `session`, `runs`, `pullRequest`,
`tasks`), each with an `epoch`, a `seq` and a `generatedAt`, and every action
of the decide, start and merge flows. Each action carries its workspace, its
session where it has one, an `actionId` the Mac issued in the projection that
offered it, and the version of the object the user saw. The phone never
derives a number or a sentence: it draws the text, the mark and the tone the
projection holds. An agent's transcript is the one reply the phone pulls
instead of receiving: a `TranscriptQuery` returns a `TranscriptProjection`,
with a `generatedAt` and no `epoch` or `seq`. An outcome carries the refusal,
the error text of a failed action and, after a limit raise, the id of its undo.

`node scripts/gen-mobile-contract.mjs <folder>` writes the Swift `Codable`
types, `tokens.json` (every `--color-*` token of `styles.css`, dark, light and
both increased contrast sets, as CSS and as sRGB) and `manifest.json` into the
folder. The contract is limited to what that script reads: aliases of object
types, intersections, string unions, unions of objects tagged by `kind`, arrays
and `T | null`. It stops with the file and line on anything else.

`contract.lock.json` pins the contract version and the hash of the generated
files. A test in `scripts/gen-mobile-contract.test.mjs` fails when a type or a
token changes and `CONTRACT_VERSION` does not: bump it, then run
`node scripts/gen-mobile-contract.mjs --lock`. A vocabulary test fails when the
contract names an attention reason, stage, tone or mark the app does not.

### Needs you across workspaces

The store holds the sessions, open questions and PR facts of the current
workspace only: opening another workspace replaces them, and a second window
owns a second workspace. `needsYouOf` itself is a pure function and counts the
moves of several workspaces as soon as it is given their sessions and stage
infos. What the other workspaces lack in the store is the facts behind the
infos (PR checks, resolve threads, live agents, open questions). The sidebar
reads them from `workspaces_attention`, which keeps only a count, a tone and
five reasons per workspace and cannot name a session. A projection that
crosses workspaces needs each workspace's facts in memory, not a second
computation in Rust.
