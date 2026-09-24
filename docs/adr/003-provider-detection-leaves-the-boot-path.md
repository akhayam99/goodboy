# ADR 003: provider detection leaves the boot path

> **Read this when** you add work to the boot sequence, read a provider's
> connection state, or compare a freshly detected provider fact with the one
> before it. **Not for** how providers are installed and connected
> ([providers.md](../providers.md)) or why boot commands must not block
> ([ADR 002](002-boot-path-leaves-the-ui-thread.md)).

Status: accepted, shipped in 0.1.81 (#1405).

## Context

[ADR 002](002-boot-path-leaves-the-ui-thread.md) settled that the boot path
must not park the UI thread. It did not settle what work the boot path may
do. Read correctly, the breadcrumbs showed `detecting-cli` dominating
launches: seven provider status detections and seven auth checks, all
subprocess-backed, inline in `hydrate.ts`, costing between 1.7 s and 7.5 s a
launch.

Two properties of the code shaped the move. A provider whose status was
`null` read as `missing`, so "not looked yet" and "not installed" were the
same value, on a surface that offers an install button against exactly that
value. And the Cursor identity comparison in `refreshProviders.ts` cleared
every stored Max Mode advisory on any change; off the boot path, the first
refresh of every launch would compare a real identity with an unread one and
wipe them all.

## Decision

- **The boot path spawns no provider subprocess.** Detection and auth checks
  stay out of `hydrate.ts`. Putting a provider probe back on the boot path
  takes a new ADR that supersedes this one.
- **`bootPhase: 'ready'` implies no provider knowledge.** It means
  migrations, settings, credentials, workspaces and session restoration are
  done, and says nothing about which CLIs exist or are signed in. Code that
  infers provider state from `ready`, or from the board being painted, is a
  defect.
- **"Not read yet" is a value.** `ProviderConnectionState` carries
  `unknown`, produced whenever a provider's status is `null`, and the store
  seeds every provider `unknown` at construction.
- **`unknown` is never connected and never missing.** A decider gating on
  `connection === 'connected'` treats it as not connected by shape. A decider
  that means "installed" spells out every state it excludes, `unknown`
  included, and never writes it as "not `missing`". Exhaustive mappings over
  the union carry an `unknown` arm, and the compiler enforces those.
- **The first detection has one entry point.** `useProviderRefreshOnFocus`,
  mounted once in `App.tsx`, schedules a refresh when `bootPhase` becomes
  `ready` and shares one TTL, one debounce and one in-flight guard with the
  focus and visibility triggers. A second entry point outside that guard
  turns a focus during boot into two detections.
- **A first read is never a transition.** A comparison of a previously
  detected value with a fresh one acts only when the previous value exists:
  the Max Mode clear in `refreshProviders.ts` runs only once `authResults`
  was already populated.
- **The phase keeps its name.** `detecting-cli` stays in `BootPhase` and in
  the breadcrumb allowlist, though it now wraps one SQLite read, so
  breadcrumb files from before and after the move stay comparable.

## Consequences

- The board paints with every provider reading `unknown`, and provider
  surfaces show that state until the first refresh lands.
- A CLI installed while the app is open appears on the next refresh that a
  focus or visibility change schedules under the shared TTL.
- A new provider decider must choose what `unknown` means for it, and the
  answer is never "installed".
- A new store fact that starts unread follows the same shape: an explicit
  unread value and a guard on the first comparison, never a nullish default
  that looks plausible.
