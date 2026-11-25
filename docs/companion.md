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
A new session runs its agents with permissions bypassed, so a phone that may
send or start can end in any command the agent chooses to run. Treat a paired
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
- A refusal is a frame the phone can show (opcode `0x0B`): `protocol_unsupported`
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
| merge  | merge a pull request                                                     | on        |
| start  | spawn agent, spawn workflow, create session from issue                   | off       |

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

A phone merge follows the desktop merge readiness rule and is stricter about
it: what blocks the desktop blocks the phone, and so do the desktop's warnings
(changes requested, a review still requested, failing or running checks) and a
mergeability GitHub has not finished computing. The phone shows a fraction of
the context and a merge cannot be undone, so the phone refuses with the same
reason the desktop would show. A repository with no required review or no CI
merges from the phone like it does on the desktop.

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

The snapshot carries only live sessions: a deleted or archived session sends
no messages, agents, turn events, context slots, plans, workflows, mounts, PR
links or external tasks. Messages are capped at the newest 500 per session, and
a workspace root is sent as its folder name, never the absolute path.

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
projection holds.

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
