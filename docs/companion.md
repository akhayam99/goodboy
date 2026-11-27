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
  phone. The private half of the key lives in the macOS Keychain (service
  `com.goodboy.desktop`, item `bridge.static_key`), never in a file. The public
  half, the remembered port and one record
  per phone (its key, the name it gave, when it paired, when it was last seen
  and its rights) sit in `~/.goodboy/companion.json`. Neither leaves the
  machine. A file from an older version that still holds the private key moves
  it into the Keychain once, reads it back, and is rewritten without it. If the
  Keychain refuses the write, nothing is moved and nothing is created: the page
  shows the fault below and the move is tried again about every 20 seconds. The
  key is never kept in a file as a fallback.
  A file written by an older version holds a bare list of keys: each becomes a
  record with the default rights and is written back in the new shape. That
  list is read until 0.45.0 (excluded).
- **Pair an iPhone** on **Settings › This Mac › iPhone** mints a one-time 256-bit token that expires after 60
  seconds and shows it with the desktop's key and addresses as a QR code. The
  payload has `v: 2`, the device name, the key, the token, the endpoints, the
  service name and the rights a new phone gets, so the phone can list them
  before it pairs. The device name is the label kept in the identity file, or
  `Mac`; the machine's host name never goes in the code or the hello.
  A phone that completes the Noise XK handshake with a live token burns the
  token and then waits: the page shows "An iPhone wants to pair" with the name
  the phone gave, Allow and Deny, and a banner is raised when the window is not
  in front, with a six digit code ("Allow only if your iPhone shows 482 913").
  Only Allow adds the phone, with the default rights. Deny, no answer
  within 60 seconds, or a second request while one waits, ends the attempt with
  a reason. A known key reconnects without a token and without a question.
- **Verification code.** The Mac and the phone each compute the code from the
  Noise handshake of that attempt; it is never sent. Take the handshake hash `h`
  (32 bytes, the final hash of the Noise XK handshake, available once message 3
  is written or read; every Noise library exposes it). Read its first four bytes as an unsigned big-endian
  integer, take it modulo 1,000,000, write it with six digits and a space after
  the third: `code = ((h[0] << 24 | h[1] << 16 | h[2] << 8 | h[3]) % 1000000)`,
  shown as `482 913`. Someone who copied the QR has a different handshake and so
  a different code, so the real phone's code is the proof. The phone shows its
  code while it waits.
- The identity is never rebuilt in silence. When the file cannot be parsed, it is
  moved aside as `companion.json.unreadable-<time>`; when the Keychain item cannot
  be read after three tries, or does not belong to the file, nothing is changed.
  In each case the page says what is wrong and offers **Reset pairing**, which
  makes a new key and an empty phone list; every phone must then scan a new code.
  A Keychain that is locked or refuses the write is tried again every 20 seconds
  (no key is ever written to a file for that). Setup of a first key follows the
  same rule: no Keychain, no identity.
- The phone opens the handshake with a version 2 hello: the version byte, a
  flag for a token, the token when there is one, and its name in a fixed 64
  byte field (66 or 98 bytes, never 0 or 32, which are version 1 payloads).
- A refusal is a frame the phone can show (opcode `0x0E`): `protocol_unsupported`
  for a hello that is not version 2 (a version 1 phone, or a newer one),
  `not_paired` for a key the desktop does not know, `token_invalid` for a
  token that was used or has expired, `rate_limited` (with `retryAfterSecs`) for
  a source the gate is slowing down, and `pairing_denied`, `pairing_expired` or
  `pairing_busy` for the three ways the Allow question can end. A connected phone
  whose record was removed hears `not_paired` before its connection closes. A
  version refusal and the three pairing answers do not count against the sender.
  A source that is slowed down gets its refusal through a short handshake of its
  own (3 seconds, 4 at a time); past that, and for a full gate, the socket is
  closed without a word.
- Remove all on Settings, iPhone (shown with two or more phones) clears every
  phone and drops every live connection; each phone must scan a new code to come
  back. Remove on one phone's row forgets that phone alone, and a live
  connection of it ends within one ping (20 seconds); its rights go at once.
  Removing the last phone stops the listener and returns the page to its start.
  The row says whether the phone is Live or Offline, since when, and its last
  sync. A phone can never re-pair itself.

## Rights per phone

| Right  | Allows                                                                                    | Default   |
| ------ | ----------------------------------------------------------------------------------------- | --------- |
| read   | the projections and the read-only queries (providers, issues, file diff)                  | always on |
| decide | send, advance step, resolve comment, set context slot, send a chat message, create a chat | on        |
| merge  | merge a pull request, merge in order, stop the train after this one                       | on        |
| start  | start a session, spawn agent, spawn workflow, create session from issue                   | off       |

The bridge checks the right of the phone that sent the command, read from the
file at that moment, so a change on Settings, iPhone applies to a connected
phone at once. A command the phone may not run is answered with
`permission_denied` and the right it lacks; nothing reaches the executor. The
hello the desktop sends after the handshake carries the phone's rights and
`endpoints`, the current private `{host, port}` pairs of the networks you
switched on (at most 8, no duplicates), so a phone finds the Mac again after its
address changes. It also carries `contractVersion`, the number in
`contractVersion.ts` (a test reads the same file), so a phone can tell an older
Mac from a current one before it asks for a field.

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
- `sendChatMessage` (0xA3) and `createChat` (0xA4) need the decide right. A chat
  is the workspace chat of the Mac, not a session. `sendChatMessage` names its
  workspace, the chat and the version it saw (the count of messages the Mac
  accepted from phones for that chat since the window opened); its action id is
  the `sendActionId` of the chat row in the `chats` projection. The chat must
  belong to that workspace and not be archived, or the Mac refuses it as
  `unknown-target`; a chat that is still answering is refused as `busy`; an old
  version is refused as `version-changed`. The text goes to the provider and the
  model the chat already uses, nowhere else. The Mac answers `done` as soon as
  the reply starts, not when it ends. `createChat` takes only the workspace,
  uses the default provider and model of the desktop chat (the saved default of
  the workspace, else the first connected provider) and answers with
  `createdChatId`. Its action id is the `createActionId` of the `chats`
  projection; a retry of the same id returns the first outcome and one chat.
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
summary of the last output, cut to 600 characters. Since contract version 6 it
also carries a `shortName` for the crumb (the first line of the goal without its
leading `[KEY]` tags, cut at a word to 32 characters), the `artifacts` of the
session (title, kind, author role, version, update time, comment count, whether
a plan waits for approval with the `approvePlan` action id, and, for a plan,
the markdown body cut to 4000 characters and 20000 UTF-8 bytes across the list; a report
and a wireframe carry no body; a discarded artifact is never listed or counted), the `questions` (the open
ones, then the answered ones, with the options, who asked and the answer) and
the `counts` the tabs show (runs, artifacts, open questions: all of them, not
only the ones sent). Each project row
adds the pull request word the Mac shows (`No pull request`, `Draft`, `Open`,
`Merged`) with its tone, the lines added and deleted of the session (absent
until every changed file is known) and the run count. The Mac loads the
artifacts, their comments and the answered questions of each live session once,
in the background, so the phone sees them without the session being opened on
the Mac. The fields are additive: a 0.2.0 phone ignores them. The `chats` projection (one per workspace, the open one only, key
`chats:<workspaceId>`) lists up to 30 chats, newest first: id, title, the model
label, a 160 character preview of the last reply, the last activity time, the
message count, whether a reply is streaming, whether the chat is pinned and the
`sendActionId`. It carries the `createActionId` of the workspace. The messages
of one chat are pulled, never published: `queryChatMessages` (0xA2, read right)
takes the workspace, the chat, a `limit` (200 at most) and an optional
`beforeMessageId` and returns the page with `hasEarlier` and `isBusy`; a chat of
another workspace or an archived one is refused. A reply reaches the phone as the
chat row changes (`isBusy`, `preview`, `messageCount`): the phone pulls the
messages again when it sees it. Paths in message text are cut to a file name.
The `tasks` projection
carries the start offer (the kinds that take Stops, the three Stops with their
words and the default one, which is the workspace level) and, for each task row,
the description (400 characters at most), the assignee's display name and the
tracker state, read from the issue the Mac holds for that task and absent when
it holds none. The `isPermitted` flag of the offer
only says the Mac offers the action: the right of the phone that asks comes in
its hello and is checked in the bridge.

### Decisions from the phone

A phone may also answer a question, approve a plan or ask for changes, allow or
deny one permission request once or allow it always for the workspace (the
`allowAlways` verdict, the same rule as Always allow on the Mac, checked against
the same decide right), raise a limit, stop or continue a run or an
agent, stop a Lead with all its running agents in one action (`stopAgentTree`),
send a message to one agent (`sendToAgent`), and send or discard a Slack reply
draft. Permission rules beyond that one verdict
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
  history, and absolute paths in any text, quoted, in a flag or in JSON too, are
  reduced to the file name by one function (`pathText.ts`) shared with the
  projections.
- A tree stop of an Auto Lead goes through the same tree stop as the desktop
  Stop; for a plain Lead it stops the running agents one by one, and a retry
  after the Lead already stopped finishes the rest. A message to an agent counts
  as sent once its turn has started, and its id carries a generation that
  changes at every launch, so a reload never reissues an old id.
- A run reads as waiting when a finished step waits for Continue, and as paused
  at its spending limit. Agent and run spend include the earlier turns of an
  agent, and the time of a stopped agent ends at its stop. Reading the ask
  transcripts of blocked agents does not mark them viewed.
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

- The listener starts at launch when at least one phone is paired, and keeps
  running; it also starts when Pair an iPhone is pressed on **Settings › This Mac
  › iPhone**. Opening the page alone starts nothing. Leaving the page with no phone
  paired stops it when this window opened a code, and so does removing the last
  phone. With a phone paired it stays up until the app quits or Remove all runs.
  Cancel on the pairing view drops the live code at once (`bridge_cancel_code`)
  and ends a pairing request that is waiting for Allow (with phones already paired
  too, whose connections stay up); with no phone paired it also stops the
  listener. A code that was still being made when Cancel was pressed is dropped
  the same way, so a phone that scans it later is refused. Each code carries a
  generation on the page: an older answer after a Cancel and a new Pair an iPhone
  is discarded and never closes the newer code.
- Switching a network on or off under Networks reaches the running listener at
  once (`LiveSelection`): it binds the new address, drops the removed one and
  advertises again, and no paired phone is disconnected for it.
- It binds each private address of the networks you switched on under Networks
  on one TCP port, never a wildcard, so the port is closed on every public
  address. Every 5 seconds the set is read again: a new address is bound, a gone
  one is released, and Bonjour follows. A connection is accepted only when the
  source is a private address and it arrived on one of those addresses (the
  check reads the destination address, so a private network that was not
  switched on can still reach an offered address when routing allows it). A private address is RFC 1918
  (10/8, 172.16/12, 192.168/16), 100.64/10 (tailnets) or an IPv6 unique local
  address (fc00::/7). Any other source is closed without an answer, before the
  gate sees it. A public IPv4, a global IPv6, a link-local or a loopback address
  is never offered in the QR or the hello, even on an interface you switched on.
  Until you choose, every private interface is on. Changing the choice restarts
  the listener on the same port. With no private network on, the code cannot be
  made and the page says so; a phone already paired stays listened for.
- The port is remembered in the identity file and asked for first at every
  start; a new one is taken only when it is busy, and is remembered in turn.
- The Mac advertises `_goodboy._tcp` over Bonjour with the opaque instance id
  as its name and the port, nothing else. It registers once per private interface you switched on (never on every
  interface), and the instance id is new at every launch, so it cannot be used
  to follow the Mac. The service host name the system publishes is the Mac's
  local host name, which Bonjour sets itself. It uses the system service (DNS-SD in
  libSystem) on macOS, so no dependency was added; other systems advertise
  nothing and the phone uses the endpoints of the hello. The advertisement is
  withdrawn when the listener stops and made again when the set of private
  addresses changes (checked every 5 seconds).
- Before a phone is authenticated the listener holds at most 8 connections,
  and at most 2 from one source address, so one holder behind a shared address
  cannot block the rest. After two failed handshakes from a source, its next
  attempts wait 2 seconds, then 4, doubling up to 5 minutes; a good handshake
  clears the wait. When 30 handshakes fail within a minute, from any sources,
  new connections are closed for 30 seconds. A connection that closes before it
  authenticates is not counted. Only a failed handshake counts, per source; a
  handshake that stalls counts for its source alone; only failed handshakes
  feed the 30 a minute pause. IPv6 sources count per /64. The table of sources
  evicts the least recently seen instead of refusing new ones. A completed
  handshake of a known phone clears its source's count. The whole Noise handshake has 10 seconds,
  then the socket is dropped and the slot frees.
- A connected phone that sends no frame for 60 seconds (three missed pings) is
  dropped; any frame, a PONG included, counts as an answer.

## The iPhone page and the top bar

- **The page has three moments.** Before a phone: three lines on what the iPhone
  does, a drawn preview of the app, the TestFlight block and Pair an iPhone as the
  one filled button. Pairing: the code with its 60 seconds, then "An iPhone wants
  to pair" with the six digit code, Allow filled and Deny. After: each phone with
  its state, since when, last sync, its rights as switches and Remove, the
  networks the Mac listens on with the port and whether Bonjour is on, and a
  failure with Reset pairing. Pair an iPhone stays in the header, quiet.
- **TestFlight block.** The public TestFlight link is the one constant
  `TESTFLIGHT_LINK` in `features/companion/testflightLink.ts`: empty, or a
  `https://testflight.apple.com/join/` link. While it is empty the block does not
  render and nothing asks for a code. When it holds a link the block shows a QR
  made on the Mac by `bridge_link_qr` (a local command that accepts only a
  TestFlight join link and runs in the main window only), the four steps and Copy
  link; when the code cannot be made the block says so and keeps Copy link. There
  is no email field and no call to a server of ours; a test reads the sources of
  the companion components and fails on `fetch`, a socket or a web address. The
  scene `u26s-settings-iphone-get` draws the block with a link that exists in the
  scene only.
- **Live and Offline.** A phone is Live while one authenticated connection of it
  is open. `bridge/live.rs` keeps the set: a second connection of the same phone
  keeps the first connection's time, and the phone is Offline when the last one
  closes. `bridge_phones` returns `liveSince` for a live phone. The last sync of
  an offline phone is `lastSeen`, written when a connection opens (at most once a
  minute) and always when it closes. A time of an earlier day reads "yesterday,
  18:20", then a weekday, then a date. Removed is the phone's word for a phone the
  Mac forgot; the Mac simply no longer lists it. One function owns each word
  (`linkWordOf`, `phoneStateTextOf`, `phoneSyncTextOf`): the bar name, its
  tooltip, the panel and the page rows say the same thing.
- **One read of the link.** `store/slices/companion-link/` holds the status and
  the phones that `bridge_status` and `bridge_phones` return; the page and the bar
  read it, and one poll (3 seconds, `retainCompanionLinkPoll`) fills it while any
  of them needs it. A late answer for an older read is dropped. A read that fails
  keeps the last good state: after two misses the page says it could not refresh;
  the bar keeps its dot. Before any good read the page shows only that it could not
  read the link, never the before-a-phone moment.
- **Top bar.** A phone glyph sits just before the bell, with a 6px status dot
  beside it (never on top): green Live, yellow Offline, red when pairing is broken
  (a fault) for a paired phone, no dot when no phone is paired, a fault included.
  The glyph is a 28 by 28 square without a dot and takes the bell's shape with
  one. With no phone a click opens the iPhone page; with one it opens a compact
  panel: the phone's name (or "Pairing is not available" in a fault), State with
  its dot and since when, Last sync, Rights, and a pinned row Open iPhone
  settings. With several phones the panel shows the live one, else the one seen
  last. Only the main window shows the icon and reads the Mac. It reads the phone
  list once, and starts the 3 second poll only while a phone is paired or the
  iPhone page is open, so someone who never paired never has the Keychain asked
  about pairing from the bar. The first read (`bridge_phones` and the cheap
  `bridge_link_hint`, which never asks the Keychain) is retried every 5 seconds
  until it answers. When the keys cannot be read, the identity holds no phones;
  the hint and `bridge_status` carry `priorPhoneCount`, the phones the file held,
  so a person who had phones keeps the poll and a red dot and sees the recovery,
  while a person who never paired still gets no dot. The offline age in the
  tooltip keeps counting while a phone is paired. While pairing is broken the page rows say "Can't
  connect" and the Listener line says the Mac is not listening, in step with the
  bar. The switch Show iPhone in the top bar, under Top bar on the page, hides the
  icon in every window: the choice is kept in local storage, which windows share,
  and each window follows a change through the `storage` event.

## What the phone sees

The phone gets projections, not database rows. The main window of the desktop
builds them in `features/companion/projections/` with the functions that draw
the same screens (`needsYouOf`, `sessionMarkOf`, `attentionWordsOf`) and
publishes them through `bridge_publish`, a command that refuses every window
but `main`. The Rust side in `bridge/publish.rs` is the border: it parses each
projection against a closed schema (`bridge/publish_schema.rs`), drops fields
the schema does not name, refuses a value outside the vocabulary, a string that
reads as an absolute path and a projection over 56,000 bytes, and cuts lists to
a fixed length (60 moves, 30 sessions per lane, 20 lines, 20 runs, 20 artifacts, 12 open and 12 answered questions, 40 tasks).
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

Contract version 8 adds the `allowAlways` permission verdict; version 9 adds
`alwaysRule` to the permission decision: `{ scope: 'workspace', label, pattern }`,
built on the Mac with the same function as the Always allow button, so the
phone shows the exact rule before the tap. A rule made from a phone is saved
with the id of that phone in the pairing file; removing the phone (or all
phones) on Settings, iPhone deletes those rules. A phone on version 7 or 8
never sends the new field.

Contract version 10 adds three optional fields and changes one list; a phone
on version 9 ignores them. `needsYou.workspaces` lists every workspace the Mac
workspace switcher shows (`state.workspaces`), with its name and a move count
that may be 0. A chats
projection is built for every workspace, not only the open one, and chats are
loaded for each of them. A Needs you row for the Lead (`auto-needs-you`) may
carry `ask`, an object with two optional parts. `question` is the last message
of the Lead, the same text the Mac shows when a step ends on a question
(`blockedQuestionOf`, assistant text only, never a tool call), with the
`<<auto>>` blocks removed by `stripControlMarkers` as the transcript does,
secrets hidden, paths cut and a length of 600 characters at most. `proposal` is
the pending proposal of the Lead, the same one the Mac shows as the next step
(`awaitingProposalOf`, a delegation waiting for a confirm): its `role`, a
`title` (the role word), a short `task`, and `options` (Start, then at most two
alternatives, each with its label, role and a Mac-minted `actionId`) plus
`notNowActionId`. Both keys are absent when there is nothing to show or the
Lead transcript is not loaded (a Lead of another workspace than the open one
has no transcript in memory, but its proposal still comes from the database).
Action `decideProposal` (`0xA5`, Decide permission, 10 a minute) carries the
delegation id, the `seenVersion` (a digest of the proposal, in the action id)
and a `choice`: `primary` confirms the delegation through the same port as the
Start button, `alternative-0` and `alternative-1` decline it and tell the Lead
"Next step: <role>" as the Mac does, `notNow` declines. A proposal that changed
is refused with `version-changed`, one decided on the Mac with
`already-decided`, and an alternative that is not offered with `invalid-request`
before anything is declined. If the Lead cannot be told after the decline, the
next step stays pending on the Mac and a retry of the same choice sends only
that message. Only the open workspace carries `actionId` and `notNowActionId`:
the proposal of another workspace is read only. The tree views of every other
workspace are read again on each refresh. A transcript sent to the phone never holds an `<<auto>>`
block: a message that was only a block is left out, the activity summary and
the session summary are cleaned the same way.
An activity line (`SessionLine`) of an agent carries `title` (its name) and
`summary` (what it did, absent when it has none) next to the joined `text`,
which stays for version 9.

### Needs you across workspaces

The store holds the sessions, open questions and PR facts of the current
workspace only: opening another workspace replaces them, and a second window
owns a second workspace. `needsYouOf` itself is a pure function and counts the
moves of several workspaces as soon as it is given their sessions and stage
infos. What the other workspaces lack in the store is the facts behind the
infos (PR checks, resolve threads, live agents, open questions). The workspace
switcher, the Home rows and the notification center read them from
`workspaces_attention` (through `attentionByWorkspaceOf`), which keeps only a count, a tone and
five reasons per workspace and cannot name a session. A projection that
crosses workspaces needs each workspace's facts in memory, not a second
computation in Rust.
