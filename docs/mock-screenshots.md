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
- `main.tsx` checks it once, outside any component, when it decides what to
  render at the root: `MOCK_ENABLED ? <MockScene /> : <App />`. `MockScene`
  loads through `lazy()` behind a `Suspense`, so the scenes and their seed
  data are a separate chunk that a production build never fetches. `App.tsx`
  itself has no mock branch, so a hot-reload never has to reconcile a
  different hook count between the two.
- `MockScene` (`apps/desktop/src/app/components/MockScene/`) reads a
  `?scene=` query param and renders one of several scene components, one per
  screenshot. To add a scene, add a file under `scenes/` and a line in the
  `MOCK_SCENES` map.

## Reuse the real components, never rebuild the UI

Every scene should render the real production component the feature uses, fed
with fake props or fake store state. A hand-built copy drifts away from the
real app as soon as either one changes, and it shows.

There are two cases, and each needs a different approach:

**The component is pure props.** `RoleHowItRuns` works
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
be used inside ToastProvider`.** `main.tsx` renders `MockScene` in place of
  `App` under the `MOCK_ENABLED` gate, so a scene never inherits `App`'s
  `ToastProvider`. A scene that renders such a component wraps itself in
  `ToastProvider`.
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
  before you trust a screenshot that looks full. `?scene=impact-deleted` fills
  every panel instead: it answers the Impact queries through `mockIPC`
  (`impactDeletedSeed.ts` matches each SELECT by its text) and seeds the
  deleted sessions into `dormantSpend`. Capture it without `&brand=1`: the brand
  chrome pins the top bar spend to a fixed figure that ignores deleted sessions.

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

A wireframe or a report renders in a sandboxed frame, which Chrome runs in its
own process. That process ignores a device scale factor set over the DevTools
protocol, so the frame comes out soft while the rest of the picture is sharp.
Add `--disable-site-isolation-trials` when you capture through CDP.

A layout change is also captured at `--window-size=1100,800`, close to the
window's minimum width, where a second rail or a fixed-width control is the
first thing to clip. Capture both themes at both widths: `&theme=light` after
the scene key renders the light theme. `&storage=reclaimable` on `board-shell`
seeds the Settings storage folders, so the top bar shows its storage chip.

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
session. `?scene=workflow-run&run=parallel` shows the same run earlier, on its
first step: three scouts working side by side, one done, and the orchestrator
waiting on the step (`scenes/flow-audit/parallelRun.ts`).
`?scene=workflow-run&run=finished` shows the run done, with every step complete
and no NOW (`scenes/flow-audit/finishedRun.ts`).
`?scene=workflow-run&run=plan-hold` shows it as a custom run held in Ask after
the plan, with **Approve plan**, **Plan ready** and the **Guidance** tag on the
steps the standing guidance went to (`scenes/flow-audit/planHoldRun.ts`).

The README and feature-area guide docs are captured from these scenes. The
`brand-*` scenes in `scenes/brand/` tell one Harborline story (issue HBL-412,
branch `hl/fix-duplicate-credit`, payments-api #318 and notify-relay #57, with
ledger-core only read), and `scenes/brand/canon.ts` holds the names and numbers
every picture shares. Add `&brand=1` to skip onboarding and hide the toasts a
browser tab raises. The README images live in `docs/readme/`, the
feature-area guide ones in the public
[goodboy-media](https://github.com/akhayam99/goodboy-media) repo, both as dark
and light `.webp` pairs. The website takes no screenshots: its product views are
React mocks. The README hero is the exception that goes the other way:
`pnpm readme:hero` draws the logo, the headline and the website's hero
`SessionMock` from the website dev server on port 1499 and writes
`docs/readme/readme-hero-{dark,light}.webp` at three times the README width. To crop a short surface, use a `--window-size` height shorter than 900. The layout keeps its own proportions and the footer stays pinned.

## Pictures for feature-area guides

Every figure in a feature-area guide sits in a stage frame: the teal-to-dark gradient
card in dark, the pale gray one in light, with the app clip inside it. `scripts/feature-shots.mjs` captures a scene in both themes,
clips it, draws the frame around it and writes
`<name>-{dark,light}.webp` into `features/` of a goodboy-media checkout,
`../goodboy-media` next to this repo or the folder `GOODBOY_MEDIA_DIR` names:

```bash
pnpm features:shots --scene 'board-shell&brand=1' --probe '[role="region"]' --window 1280x720
pnpm features:shots --scene 'board-shell&brand=1' --out board-stage --selector 'main' --window 1280x600
```

- `--probe` prints the box, classes and text of the matching elements, so you
  can pick a `--selector` or a `--clip x,y,w,h` without opening a browser.
- The clip renders at `--scale 3` (default) and the frame is drawn at the same
  device scale, so the app pixels are never resampled.
- The frame's corners are transparent, so one file reads on both GitHub
  themes. The dark and light files still follow the OS through `<picture>`.
- The script prints the frame's css width. A frame narrower than 880 gets
  `width="<that width>"` on its `<img>`, or GitHub enlarges it.
- `GOODBOY_SHOT_URL` or `--base` points at the dev server
  (default `http://localhost:5230`).
- With several captures running against one dev server, a cold scene can take
  more than the default 5 seconds and the file shows the "starting up" screen
  (about 40 KB). Pass `--wait 30000`, capture one theme per run with
  `--themes dark`, and look at every file before keeping it.
- Put `%20` for spaces inside `--scene`, or Chrome never loads the page.
- `--click "Commits,Sort"` clicks, in order, the buttons, tabs or links whose text starts with each name, after the scene loads and before the capture. It shoots a state a scene does not open by itself, such as a second tab or an open picker. A name that matches nothing stops the run.

Each feature-area guide points at each file with its raw URL,
`https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/<name>-dark.webp`.
Pictures live outside this repo so each reshoot does not grow its history:
push the new files to goodboy-media first, then the text here. Reusing a name
replaces the picture in place, within the five minutes GitHub caches it.

A figure shows exactly the feature named by the heading it sits under, and its
alt text names what is visible.

## Pictures for the changelog

A changelog entry can carry a before/after picture (`image=<name>` in
`CHANGELOG.md`, see `docs/release-command.md` Format). These come from the
same mock scenes, captured a different way: `scripts/changelog-shots.mjs
<scene> <name> <before|after>` drives headless Chrome over CDP against the
scene at `http://localhost:1421/?scene=<scene>&theme=<dark|light>` (start
`pnpm dev` in `apps/desktop` first, same as everywhere else on this page), and
saves `docs/changelog/next/<name>-<before|after>-{dark,light}.webp`.

- **`[data-shot]` marks the capture target.** The scene's own root element
  needs this attribute; nothing else does. It is not the same target as a
  README screenshot, which captures the whole viewport. The script clips to
  this element's box, at 680×425 CSS pixels, DPR 2 (1360×850 physical), and
  converts through `cwebp -q 80`. A scene without `[data-shot]` is captured
  whole instead, at a 1360×850 window and DPR 1, so the picture keeps the same
  size. Extra scene params ride in the scene argument
  (`'session-start&kind=workflow'`), and `GOODBOY_SHOT_URL` points the script
  at a dev server on another port.
- **Both themes, one command each.** The script captures dark and light in
  one run; a scene that renders differently per theme needs no extra work,
  the `&theme=` query param already switches it (`MockScene/index.tsx`).
- **Timing.** A PR that changes an existing screen photographs the scene on
  `main`, before the change, as `-before-`; after the change, the same scene,
  same name, as `-after-`. A brand-new screen only ever gets `-after-`: there
  is nothing to be "before".
- **Promotion at the version bump.** `docs/changelog/next/*` holds
  work-in-progress pictures across PRs in the same release. The PR that bumps
  the version numbers renames the `next` folder to `docs/changelog/<version>/` and sets
  `image=<name>` on the entry. `changelogImageBudget.test.ts` then checks
  names, complete dark/light pairs, that a `before` has a matching `after`,
  at most 3 images and 1 MB per release, and no orphan file.
- **Retroactive from the release's own code.** A release that already
  shipped can gain pictures, but never capture today's app under an old
  entry's name: the picture would show a screen the release never had.
  Capture `-after-` from a checkout of that release's tag and `-before-`
  from the previous release's tag. The app loads pictures from `main` first
  and falls back to the tag, so files committed after the tag still show.
