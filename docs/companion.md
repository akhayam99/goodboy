# Companion bridge

> **Read this when** you are changing how a phone pairs with the desktop, what
> a paired phone may ask for, or when the pairing listener runs. **Not for**
> the phone app itself (its wire contract is `PROTOCOL.md` in the mobile
> repository) or the data disclosure users read (`SECURITY.md`).

Goodboy for iPhone talks to a running desktop over the local network. The
desktop side is the Rust module `apps/desktop/src-tauri/src/bridge/` plus the
frontend executor in `apps/desktop/src/features/companion/`. The wire protocol,
opcodes, Noise parameters and token lifetime are frozen by the mobile contract:
a change there breaks every paired phone.

## The invariant

**Pairing a phone grants it the ability to run agents on this machine.** A
paired phone can send messages into a session, start agents and workflows,
advance workflow steps, resolve review comments, create sessions from issues,
and merge pull requests. A new session runs its agents with permissions
bypassed, so a message from the phone can end in any command the agent
chooses to run. Treat
a paired phone like a second keyboard, not like a viewer.

## Pairing

- The desktop keeps a long-term Noise static key and an allow list of paired
  phone keys in `~/.goodboy/companion.json`. It never leaves the machine.
- Settings, iPhone mints a one-time 256-bit token that expires after 60
  seconds and shows it with the desktop's key and address as a QR code. A
  phone that completes the Noise XK handshake with a live token is added to
  the allow list and the token is burned. A known key reconnects without a
  token.
- The allow list holds any number of phones. Disconnect on Settings, iPhone
  clears all of them and drops every live connection; each phone must scan a
  new code to come back. A phone can never re-pair itself.

## What a phone may ask

The phone requests only a closed set of actions, decoded from fixed opcodes.
It never supplies an origin, a path, a working directory, or tool or
permission flags. The bridge stamps every command `mobile` from the channel it
arrived on and forwards it to the desktop frontend, which is the trusted gate:
it checks scope and runs the same store actions the desktop UI uses. There is
no raw or exec action. Merge policy lives in the frontend executor, not in the
bridge.

A phone merge follows the desktop merge readiness rule and is stricter about
it: what blocks the desktop blocks the phone, and so do the desktop's warnings
(changes requested, a review still requested, failing or running checks) and a
mergeability GitHub has not finished computing. The phone shows a fraction of
the context and a merge cannot be undone, so the phone refuses with the same
reason the desktop would show. A repository with no required review or no CI
merges from the phone like it does on the desktop.

### Decisions from the phone

A phone may also answer a question, approve a plan or ask for changes, allow or
deny one permission request once, raise a limit, stop or continue a run or an
agent, and send or discard a Slack reply draft. Always allow, permission rules
and every other setting stay on the Mac. Each of these actions follows five
rules, kept in `features/companion/actions/`:

- It names its target and the version the phone saw: the question text, the
  plan version, the hash of the tool and its input, the limit, the run or agent
  state, the draft. The Mac compares and refuses with a code, a message and the
  list of what changed. A stop or continue that already holds is a no-op.
- The action id is `act:<kind>:<objectId>:<version>`, built by the Mac in the
  projection that offers the action, so a retry reuses it. The executor
  recomputes it from the action's own fields and refuses an id that differs. It
  keeps the last 500 finished outcomes and answers a repeated id with the first
  outcome and `isReplay: true`. An id that is still running is refused as a
  duplicate. A failed action is not kept, so a retry with the same id runs again.
- Each action has its own rate limit per minute and a text cap of 4,000
  characters. A limit is raised only to an amount the Mac offered (the current
  limit plus 5, plus 10 or doubled, never above $500), and a raise can be undone
  once while the limit is still the raised one.
- The phone needs the permission to decide. The check reads one scope function
  (`phoneScope.ts`) that allows every phone until the pairing settings register
  their own reader.
- The same store action runs as on the desktop: a permission goes through
  Allow and continue or Deny, a plan through the Lead approval, a stop through
  the confirmed stop of the turn.

The phone reads one agent's conversation on request: words as text, each tool as
one short line with the file name and the changed line counts, never a diff and
never an absolute path.

An action of an older phone that is not in the contract (`advanceStep`,
`spawnAgent`, `resolveComment`, `setContextSlot`, `spawnWorkflow`) still runs
for a v1 phone and has no v2 counterpart; `send` and `createSessionFromIssue`
stay until the start action replaces them.

## Listener lifetime

- Nothing listens at boot. The listener starts when Settings, iPhone opens.
  Leaving the page with no phone paired stops it; with at least one phone
  paired it stays up so that phone can reconnect, until the app quits or
  Disconnect runs.
- It binds a random TCP port on all network interfaces, while the QR advertises
  only the primary LAN IPv4. A handshake without a live token or a known key
  is refused, but the port answers on every interface while it is open.
- Before a phone is authenticated the listener holds at most 8 connections,
  one per source address; the next one is closed at accept. The whole Noise
  handshake has 10 seconds, then the socket is dropped and the slot frees.
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
A workspace is sent by its name only, a project by its name, never a path. A
projection holds no archived or deleted session, and none of the transcript.

Only what changed is sent: the phone gets one frame per changed projection
(`0x0B`), a frame when one disappears (`0x0D`), and everything again when it
asks (`0x82`). The other workspaces are read by a read-only loader that never
writes the store; for them the sessions, agents, open questions and tasks come
from the database, and the pull request facts, mounts and project names are not
loaded, so a pull request reason shows for the current workspace only.

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
