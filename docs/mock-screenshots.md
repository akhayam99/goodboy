# Mock screenshots

> **Read this when** you need a real-app screenshot with fake, advanced,
> non-empty state (for a social post, a README image, a deck). **Not for**
> testing (see `docs/testing.md`).

Every published screenshot follows one rule: real components, fake data, never
an empty state, never real client or project names. Getting there the slow way
takes an afternoon. This page is the fast way, written down once, in full.

## Do not run the Tauri desktop app

Your first instinct is to launch the real `.app` and drive it. Don't. Two
problems add up. First, a second instance fights the production build over
window focus and the same bundle identifier. Second, a Tauri dev build's
WKWebView can keep showing old content, even after `curl` confirms, byte for
byte, that the served source is correct. Nobody found out why. Every
diagnostic was tried, then the hunt was dropped. No root cause was found, and
the fix was to stop using the desktop shell entirely.

Run `pnpm dev` in `apps/desktop` and open its URL in an ordinary browser. It
starts the Vite dev server on the port set by `tauri.conf.json`'s `devUrl`,
currently 1421. The app's own code only needs the Tauri runtime when a
component calls `invoke()` directly. The mock scenes below never do, so this
works as is. The browser's own devtools (console, network, DOM) also let you
see things the Tauri webview hides.

## Turn on mock mode

- `apps/desktop/.env.local` (gitignored) must contain `VITE_GOODBOY_MOCK=1`.
  An env var exported in the shell before `pnpm dev` is **not** picked up the
  same way. It has to be this file.
- `apps/desktop/src/store/mock-data.ts` exports `MOCK_ENABLED =
import.meta.env.VITE_GOODBOY_MOCK === '1' && import.meta.env.MODE !== 'test'`.
  The test-mode half is not optional. Vitest reads the same `.env.local`.
  Without that half, every suite that renders `App` gets a mock scene instead.
  It then fails in a way that looks like a regression in the feature under
  test.
- `App.tsx` checks it on the very first line of the `App` component body,
  before any hook: `if (MOCK_ENABLED) { return <MockScene />; }`. It has to
  come before the hooks, not after. Otherwise React's rule about a fixed number
  of hooks breaks on the next hot-reload.
- `MockScene` (`apps/desktop/src/app/components/MockScene/`) reads a
  `?scene=` query param and renders one of several scene components, one per
  screenshot. To add a scene, add a file under `scenes/` and a line in the
  `MOCK_SCENES` map.

## Reuse the real components, never rebuild the UI

Every scene should render the real production component the feature uses, fed
with fake props or fake store state. A hand-built copy drifts away from the
real app as soon as either one changes, and it shows.

There are two cases, and each needs a different approach:

**The component is pure props.** `RoleModelRow` works
this way. Read the component's prop type and build fake data that matches it.
Use real branded id casts (e.g. `'x' as Agent['id']`) and real enum values.
Pass it straight in. No store involved.

**The component reads the zustand store.** `SessionOverviewPane`,
`WorkflowRunDetail`, `DefaultsPanel`, `SessionNavSidebar` and `AppFooter`'s
enabling flags work this way. `useAppStore` is a bare `create()` store: no `persist` middleware,
and no Tauri side effect on `setState`. So it is safe to fill it directly:

```tsx
useEffect(() => {
  useAppStore.setState({
    workspaces: [FAKE_WORKSPACE],
    sessions: [FAKE_SESSION],
    sessionGithub: { [FAKE_SESSION.id]: { pr: FAKE_PR, ... } },
    // every store key the component (and the hooks it calls) reads
    loadAgentTranscript: async () => undefined, // action functions can be stubbed too
  });
}, []);
```

The hard part is knowing which keys to fill. Read the component's hook calls
(`useAppStore((s) => s.foo[id])`), then every hook those call in turn, not
only the top-level props. If a hook one level down needs a key you didn't
fill, nothing crashes. It quietly renders empty, and that looks like a bug in
the component instead of a gap in the mock.

## Gotchas hit while building the scenes

- **Every "role" badge goes through `classifyAgent`.** The
  `agentKindOverride` entry for the agent id wins, then `agent.kind`, then the
  agent name. Setting `kind: 'implementer'` on the agent is enough.
  Components that take `agentKindOverride` as a prop (`RunTree`)
  read the prop instead of the store, so an override set only in the store
  does not reach them.
- **Provider/model routing badges** fall back to `run.modelOverride` /
  `run.providerOverride` on the `Agent` object when the
  `agentModelOverride`/`agentProviderOverride` prop maps are empty. Use real
  ids from `packages/core/src/providers/*/catalog.ts` (e.g. cursor's
  `composer-2.5-fast`, codex's `gpt-6-astra` or `gpt-5.6-sol`), not made-up
  strings. `RoutingLabel` and the model picker look up their labels in that
  catalog.
- **Fan-out / sub-agents** in the workflow detail come from
  `sessionPhaseRuns`: an agent with `parentAgentId` set is a child of that
  step. `RunTree` numbers it (`2.1`, `2.2`) and draws it on its own lane one
  column right. You don't compute or render that yourself.
- **Mounting anything that calls `useToast` on its own throws `useToast must
be used inside ToastProvider`.** `App` returns `MockScene` under the
  `MOCK_ENABLED` gate before it mounts `ToastProvider`. So a scene that renders
  such a component wraps itself in `ToastProvider`.
- **`AppShell` already has `leftSidebar` and `footer` slots.** You need no
  layout code to add the real session sidebar or the real app footer to a
  scene. Pass the components into those two props.
- **A fixed timestamp drifts every day.** The UI measures elapsed and relative
  times against the real clock, so a literal `'2026-08-25T17:57:00.000Z'`
  reads as a step running for days. Wrap every seeded instant in
  `sceneClock` (`apps/desktop/src/app/components/MockScene/sceneClock.ts`):
  `clock.iso({ at })` and
  `clock.ms({ at })` shift it so the anchor lands on the moment the scene
  loaded, and the gaps between events stay exact. Files that share seed data
  use the same anchor. The anchor must be at or after the latest instant its
  clock shifts, including instants computed from a seeded one, or events land
  in the future. A grep for ISO literals misses dates assembled at runtime, so
  also search the scene for template literals such as
  `${DAY_TWO}T10:05:00.000Z`, date-only constants such as `'2026-09-17'`,
  `Date.UTC`, `new Date(` with numbers, and arithmetic that adds minutes to a
  seeded NOW. A scene built on `Date.now()` needs no clock.

- **A studio can reach `invoke()` through a hook you never render.** The rule
  above says the render must never depend on the Tauri runtime, and
  `ImpactStudio` keeps it. Its `useImpactMetrics` queries the database
  directly, fails, and catches its own error. The provider scope the scene
  opens on renders nothing from it. Filling the store cannot reach that hook,
  because it does not go through a store action. When a scene mounts a studio,
  open it on the scope whose panels read from the store. Check the console
  before you trust a screenshot that looks full.

## Capture the actual image, not a browser-pane screenshot

The screenshot tool of an interactive browser pane adds its own chrome (a tab
badge, capture-indicator artifacts), and it caps the image at a smaller size.
For the file that gets committed and posted, run headless Chrome from the
shell against the same localhost URL:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1440,900 --virtual-time-budget=4000 \
  --screenshot=out.png "http://localhost:1421/?scene=board-shell"
```

`--window-size=1440,900` matches the Tauri window's fixed default size in
`tauri.conf.json`, so the crop matches what the real app looks like.
`--force-device-scale-factor=2` gives a retina image. `--virtual-time-budget`
gives the mock scene's `useEffect` time to fill the store, and React time to
render, before the snapshot is taken.

A layout change is also captured at `--window-size=1100,800`, close to the
window's minimum width, where a second rail or a fixed-width control is the
first thing to clip. Capture both themes at both widths: `&theme=light` after
the scene key renders the light theme.

## Data hygiene

Fake workspace names, session goals and usernames must be generic but
believable. They must never be a real client, project or person. Seeds use one
fixed vocabulary: workspaces Harborline, Northwind, Acme, Cascade and
Cascadia; repos ledger-core, notify-relay, payments-api, billing-api,
web-console, storefront-web, core-api and reporting-analytics; people named by role (platform lead, finance lead, reviewer),
never by a personal name. Include at least one "hard" task among the fake ones
(a rate-limiting bug, a rounding bug), not only trivial ones. If every task
looks easy, the product looks like it's only for easy tasks.

## What already exists

`apps/desktop/src/app/components/MockScene/` holds one scene component per
screenshot. Each one is registered by key in the `MOCK_SCENES` map and filled
from `apps/desktop/src/store/mock-data.ts` plus its own seed module. Read the
map before you build anything. The surface you need is often already there,
and the keys are the `?scene=` values. The scenes cost nothing at runtime when
`VITE_GOODBOY_MOCK` is unset.

README images always show the app around the feature. Two frames wrap them:

- `ShellFrame` in `scenes/shellChrome.tsx` (top bar, sessions sidebar, crumb
  bar, footer) is for anything inside a session. Fill it with `seedShellChrome`.
- `StudioFrame` in `scenes/StudioFrame.tsx` (top bar and footer) is for studios
  such as Settings, Impact and the Inbox. Fill it with `seedStudioChrome`.

`scenes/sceneReveal.ts` opens the completed mounts and keeps a mount row in
its hover state, so the row actions show up in a still image.

Scenes that set a state through query params (`&mode=`, `&v=`, `&open=`,
`&view=`) live in `scenes/audit/`, one file per scene, and share the frame,
settings and workspace seeds there. They are registered in `MOCK_SCENES` like
every other scene. A scene opens a studio through the same entrance the app
uses (a store opener or a click on the real control), never by mounting the
studio itself.

Scenes that share one seed live in a folder, with one file per scene, a
`fixtures.ts` for the data and a `seeds.ts` that writes it into the store.
`scenes/flow-audit/` covers the workflow builder, a workflow run, the open
questions cluster, the transcript and the command palette over one Harborline
session.

The README's feature guide is captured from these scenes. The images live in
`docs/images/`, named after the scene that made them, so a re-capture is one
command with no lookup. To crop a short surface, use a `--window-size` height
shorter than 900. The layout keeps its own proportions and the footer stays
pinned.
