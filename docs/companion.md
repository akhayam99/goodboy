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

The snapshot carries only live sessions: a deleted or archived session sends
no messages, agents, turn events, context slots, plans, workflows, mounts, PR
links or external tasks. Messages are capped at the newest 500 per session, and
a workspace root is sent as its folder name, never the absolute path.

A `send` that names an `agentId` must name an agent of that session. The
executor refuses an id longer than 64 characters, a non-string, and an id the
session does not hold, before any turn starts. Resolver agents are not in the
session's agent list, so the phone cannot address them.
