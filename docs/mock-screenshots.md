# Mock screenshots

> **Read this when** you need a real-app screenshot with fake, advanced,
> non-empty state (for a social post, a README image, a deck), or you add a
> mock scene. Scenes serve screenshots and tests: the a11y suite mounts and
> scans every scene, and a scene with clickable writes is clicked by its twin
> test. **Not for** proving behavior, which lives in harness tests (see
> `docs/testing.md`).

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

- Set `VITE_GOODBOY_MOCK=1` in the shell that starts `pnpm dev`, or put it in
  the gitignored `apps/desktop/.env.local`. Vite reads either form before the
  app starts.
- `apps/desktop/src/store/mock-data.ts` exports `MOCK_ENABLED =
import.meta.env.VITE_GOODBOY_MOCK === '1' && import.meta.env.MODE !== 'test'`.
  The test-mode half is not optional. Vitest reads the same `.env.local`.
  Without that half, every suite that renders `App` gets a mock scene instead.
  It then fails in a way that looks like a regression in the feature under
  test.
- `main.tsx` checks it once, outside any component, when it decides what to
  render at the root: `MOCK_ENABLED ? <MockEntry /> : <App />`. `MockEntry`
  (`MockScene/MockEntry.tsx`) loads through `lazy()` behind a `Suspense` and
  lazy-loads either the phone page or `MockScene`, so the scenes and their seed
  data are a separate chunk that a production build never fetches. `App.tsx`
  itself has no mock branch, so a hot-reload never has to reconcile a
  different hook count between the two.
- `MockScene` (`apps/desktop/src/app/components/MockScene/`) reads a
  `?scene=` query param and renders one of several scene components, one per
  screenshot. To add a scene, follow [recipes/mock-scene.md](recipes/mock-scene.md).

## Static demo build

`pnpm --dir apps/desktop build:demo` typechecks and builds a production mock
site into the gitignored `apps/desktop/dist-demo/`. The script in
`apps/desktop/package.json` enables `VITE_GOODBOY_MOCK=1`, uses mode `demo`
and sets a relative asset base, so the same output serves the root of
`demo.goodboy-ai.dev` and `vite preview` without the Tauri runtime. It uses the existing mock entry in `apps/desktop/src/main.tsx`.
`apps/desktop/src/shared/lib/scrollerStyle.ts` returns the browser scrollbar
default before scene IPC is installed, so the root provider does not call
native IPC during that first mount.
Do not include private values in `VITE_*` or `TAURI_ENV_*` variables: the
`envPrefix` in `apps/desktop/vite.config.ts` exposes those prefixes to the client.

Mode `demo` also changes the scene a bare URL opens: `MockScene/index.tsx`
falls back to `demo` (the playground) in that mode and to `workspace` in mock
dev. Preview with `pnpm --dir apps/desktop exec vite preview --outDir dist-demo --port 5194 --strictPort`
and open `http://localhost:5194/` for the playground, or
`http://localhost:5194/?scene=chat-shell` for a single frame.

A phone never gets the playground. When the pointer is coarse and nothing
hovers (`(hover: none) and (pointer: coarse)`, never a width), `MockEntry`
lazy-loads `MockScene/demo/phone/DemoPhone` instead of `MockScene`, so no
scene chunk and no iframe loads. The page says what Goodboy is, stars the
repository and hands the canonical demo link (with a valid chapter hash) to
the Web Share API, or copies it and confirms only once the clipboard
resolves. A cancelled share changes nothing; a failed copy shows the link in a
read-only field to select by hand and turns the button into Try again. A tablet with a trackpad reports a fine pointer and gets the
playground. `shouldOpenDemoPhone.ts` owns the rule and `DemoPhone.test.tsx`
pins it.

Keep source maps off for public output. The eager registry in `MockScene/registry/index.ts` bundles
every scene fixture, not only the playground's, so every fixture is public:
paths are `~/code/<mock company>/<repo>` (never `/Users/` or `/home/`), email
addresses sit on a mock company or reserved domain, and nothing is shaped like
a provider or GitHub token. `__tests__/regressions/scene-fixtures-are-public-safe.test.ts`
fails CI on any of the three under `MockScene/`.

### Published demo

The demo lives at `demo.goodboy-ai.dev`, a Vercel project of its own next to
the website's. `apps/desktop/vercel.json` holds the build: no framework,
`pnpm install --frozen-lockfile --ignore-scripts` (the root `prepare` runs
`lefthook install`, which fails without a `.git` folder, and the demo needs no
other install script), `pnpm build:demo`, output `dist-demo`, clean URLs, a
year of `immutable` cache on the hashed `/assets/`, revalidation on every
other path, and headers that allow framing by the same origin only (the
playground iframes its own beats). The file sits outside `dist/` and
`src-tauri/`, so the Tauri build never reads it. The demo bundle carries no telemetry and no cookie. Its one
network call is Vercel Web Analytics, cookieless, added by the `demoPlugins` Vite plugin in
`apps/desktop/vite/demoHtml.ts`: it runs only for `--mode demo` and only in a build, and adds
`<script defer src="/_vercel/insights/script.js">` and an early theme script to `dist-demo/index.html`.
The Tauri build, `pnpm dev` and the app's own `index.html` never carry either, and
`apps/desktop/vite/demoHtml.test.ts` pins that.

The website links it as Live demo from `SITE.demo` in `website/src/site.ts`:
the yellow pill in the nav actions (a sheet link on narrow screens), the
hero's text link and the install section on desktop, and the footer.

Production deploys only on a release commit, so the demo always matches the
version on the download page. The project's `ignoreCommand` runs
`scripts/demo-ignore-build.mjs`: on `VERCEL_ENV=production` it builds only when
the first line of `VERCEL_GIT_COMMIT_MESSAGE` is a release subject
(`chore(repo): release X.Y.Z`, with or without ` (#N)`), and it skips every
other push to `main`. Preview deployments of other branches always build.
`scripts/demo-ignore-build.test.mjs` pins both answers.

The owner sets these by hand in the Vercel project, since `vercel.json` cannot:

- Git repository `akhayam99/goodboy`, Root Directory `apps/desktop`, "Include
  files outside the root directory in the Build Step" on (the default), so the
  install reaches the workspace root and `scripts/`.
- Production Branch `main`, Node.js version 22.x or later.
- Environment variable `ENABLE_EXPERIMENTAL_COREPACK=1`, so the build uses the
  `packageManager` pin in the root `package.json`.
- Domain `demo.goodboy-ai.dev`, with the DNS record Vercel asks for.
- Web Analytics on for this project, which serves `/_vercel/insights/script.js`,
  and Speed Insights off. Leave every other environment variable empty:
  anything named `VITE_*` would ship in the bundle.

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
`OrchestratedRunPage`, `DefaultsPanel` and `SessionNavSidebar` work
this way. `useAppStore` is a bare `create()` store: no `persist` middleware,
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
- **`AppShell` already has a `leftSidebar` slot.** You need no layout code to
  add the real side column to a scene. Pass the component into that prop.
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
seeds the Settings storage folders, so Settings > Storage shows what can go.

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
screenshot. Each one is registered by its id through the `scenes/u*/` glob ([recipes/mock-scene.md](recipes/mock-scene.md)) and filled
from `apps/desktop/src/store/mock-data.ts` plus its own seed module. Read
`scenes.txt` before you build anything. The surface you need is often already there,
and the keys are the `?scene=` values. The scenes cost nothing at runtime when
`VITE_GOODBOY_MOCK` is unset.

README images always show the app around the feature. Two frames wrap them:

- `ShellFrame` in `scenes/shellChrome.tsx` (top bar, sessions sidebar, crumb
  bar, footer) is for anything inside a session. Fill it with `seedShellChrome`.
- `StudioFrame` in `scenes/StudioFrame.tsx` (top bar and footer) is for studios
  such as Settings, Impact and Tasks. Fill it with `seedStudioChrome`.

Every frame (these two, `audit/WorkspaceFrame` and the board shell) takes its
column actions, studio and overlay layers from `scenes/useSceneShell`, which
runs the app's own `useAppOverlays`: Board, Tasks, Chat, Workflows and Settings
in the column work as in the app, Settings swaps the column and **Back to app**
returns. A scene that installs its own IPC answers goes through
`scenes/mockSceneIpc.ts`, which answers editor and browser detection, `db_select`,
the workflow and budget rule lists and the unread list with an empty list, and
`db_execute` with no rows touched, when the scene has nothing, so Settings and
the Branch page open there too. A bare `mockIPC` answers `undefined` and the
real code crashes on it in a browser, never in a unit test that mocks `invoke`. The `shell`
scene mounts the real `SessionWorkspace` (trail band, **Ask**, page rows that
move), and a scene that opens a session seeds its agents and plans so the
overview never stays on its loading skeleton.

A scene whose flow writes can be clicked through, not only looked at.
`scenes/sceneDatabase.ts` (`installSceneDatabase`) keeps the settings rows in
memory and answers the live session ids, so **Pin session** and **Unpin
session** run the real `changeSessionPins` and the Pinned group follows (the
sidebar scenes seed the pin row too, so a new pin never wipes the seeded ones),
and a held run's approval writes its rows. `scenes/scenePlanEngine.ts`
(`installScenePlanEngine`) answers the plan flows at the store: an added
comment is a draft, **Send to planner** marks it sent, runs the planner as a
running turn for 1.4s and lands v3 with the comments addressed (or answers
without a change for the reply-only scene), **Save** writes the new text as the
next version unless the scene is the conflict one, and the next step starts at
once. Approving a plan is the real `approveWorkflowRunPlan`. The plan drawer
scenes and the plan scenes of the run page install both. `plan-drawer-follow`
opens the drawer over the Overview, so **Approve** raises the "Plan approved"
toast with **Follow the run**; over the run page the toast has no action,
because the page is already there. `plan-drawer-approved` is the orchestrated
case: the run has no next step yet, `?approve=1` presses **Approve** on its own,
and reopening the plan through **Review plan** shows **Approved** with no
primary.

Scenes that set a state through query params (`&mode=`, `&v=`, `&open=`,
`&view=`) live in `scenes/audit/`, one file per scene, and share the frame,
settings and workspace seeds there. They are registered in `MOCK_SCENES` like
every other scene. A scene opens a studio through the same entrance the app
uses (a store opener or a click on the real control), never by mounting the
studio itself.

The setup and Home scenes live in `scenes/onboarding/` and sit in one
`ONBOARDING_SCENES` block of `registry/base.ts`, each state once per theme:
`onboarding-step-<state>-<theme>` for the wizard steps (welcome, four agents
states, three tools states, two first session states),
`onboarding-new-workspace-<state>-<theme>` for the one form,
`onboarding-home-<state>-<theme>` (list, new, empty),
`onboarding-setup-menu-<theme>` and `onboarding-brand-tile-<theme>`. The step
scenes share `wizardSceneSeed.ts` (Acme web, the plain Acme docs, four agent
CLIs) and settle all motion, because a headless capture does not advance CSS
motion. Two take params instead, for the guide figures, whose shots switch
theme with `&theme=`: `onboarding` opens the real setup wizard through its open
event, with `&step=` a step id (`welcome`, `agents`, `workspace`, `tools`,
`first-session`), `&agents=` an agents state (`ready`, `signin`, `none`,
`error`) and `&ws=` a workspace state (`none`, `repo` for Acme web, `folder` for
Acme docs; `none` up to Workspace, `repo` after it), and
`onboarding-home&state=` shows Home in `list`, `new` or `empty`.

`demo` is the playground, a guided path and not a catalog. Its unit is the
step: one action the visitor does in the app. A group (`demoChapters.ts`, names
and one line in `demoGroups.ts`, which the phone page reads too) is an ordered
list of steps and a list of frames. A step is a hint (`hints/demoHintTypes.ts`):
`label` for the rail, `copy` for the coach mark, `instruction` for the header,
`result` for the line that follows the action, `beat` for the frame it lives in,
an anchor, and two checks. A frame (`DemoBeat`) is another scene loaded in an
iframe of the same server (`?scene=<id>&<params>&theme=<dark|light>`), so every
frame gets a clean store and its own timers. The stage fills the space the page
leaves it and the app fills the stage: a frame's viewport is the stage box
divided by a scale that is the one of a 1440 by 900 app fitted to the box and
never above 1 (`appSize.ts`, `stageFitOf.ts`, measured by `useStageBox`), so the
app is never zoomed: a bigger stage shows more room, not bigger type. Every
group, Set up included, uses the same scale. The stage has no inset and sits on
the same grid as the top of the rail, with narrow gutters, so the app is a bit
bigger only because its box is.
`#<group id>` in the URL opens a group the visitor may open, and anything else
opens Set up (`defaultGroupId.ts`).

The rail is one vertical spine drawn with the app's own primitives: rows go
through `layoutTimelineRail`, drawn by `TimelineRail` in a `SpawnedRailCell`,
with `WorkNode` markers, the same ones as the Spawned panel (`demoRailOf.ts`,
`DemoRail.tsx`, `DemoRailGroupRow.tsx`, `DemoRailStep.tsx`). Each group is a
heading on the spine with its title, an "Optional" tag for Set up and a quiet
"n of m" count. The open group lists its steps under it, indented on an elbow:
a done step is a check, the step in progress is the live marker, the steps after
it are dashed. A step is never a button: the path only moves forward. The
rail is the only place that shows the position: the header and the coach mark
carry no dots and no "Step n of m" (the compact switcher, which replaces the
rail on narrow windows, keeps its own). Get Goodboy closes the same spine.

The path is sequential (`hints/groupAccessOf.ts`). A group is `done` once all its
steps are, `locked` while a group before it that is not optional is not done,
and `open` otherwise; Set up is optional, so it is always open and never holds
the others back, and the first required group is open from the start. A locked
group row is muted, disabled and has no hover state. A done group stays open to
revisit, on its last frame with every step checked. A hash that names a locked
group opens Set up. Get Goodboy is locked until every required group is done.
"Up next" (`data-up-next="ready"`, a solid ring and a soft glow for three cycles,
then rest) appears only on the group after the open one, and only once the open
group has every step done; before that nothing glows. Restart clears every
group and goes back to the first step of Set up. The rail is hidden below the
`lg` breakpoint; `DemoCompactNav` then shows the group switcher (Next group is
disabled while the next group is locked) and the current step. The top bar's
left side holds the logo and a goodboy-ai.dev link back to the website (both
carry the current `?theme=`). Download for macOS and Star on GitHub live only on
the Get Goodboy screen (`DemoClosing`). The page behind the stage uses the
`surround` surface, a touch darker than the app surfaces (lighter than the
first cut in dark), so the app frame reads as a window.

The theme has one owner, `useDemoTheme`: the `?theme=dark|light` of the url
wins on first load, then the choice kept under `goodboy-demo-theme` (every read
and write survives blocked storage), then dark, and the param is stripped from
the url right after. The website appends it at click time from its own theme
(`website/src/theme/syncDemoLinks.ts`, one delegated listener, never read
during render because the site prerenders). Toggling the theme never reloads a
frame: frames are keyed by scene, params and replay (`frameKey.ts`), not by
theme, the stage sends every ready frame a `theme` command, and the frame
applies it live. The app's own theme control inside a frame reports `theme` to
the playground (same envelope, origin and source checks, one report per change
the frame did not receive from the playground), which switches the wrapper and
sends it on to every other frame.

Every beat frame carries `&director=1`. Without that param a scene stays as
static as before, so screenshots and the a11y suite never see a director. With
it, `MockScene` mounts `demo/DemoDirector`, which waits for fonts and two
painted frames, then builds the scene's timeline from the seeded store
(`demo/director/demoTimelines.ts`: `chat-shell`, the `c07-auto-*` beats,
`board-shell`, the artifact, diff and resolve beats; any other scene gets an
empty one). A timeline rewinds the
seeded state in `prepare` and replays it as cues `{ atMs, apply }` against the
real `useAppStore`, on a playback clock that leaves pauses out. Assistant text
marks the live text registry first, so it streams through the product's own
reveal. The frame and the playground talk over `postMessage` on channel
`goodboy-demo`, version 1, both sides checking origin and the exact source
window. The frame reports `ready` (seeded and painted, cues waiting), `progress`,
`complete` and `hint` (a cue's `hint({ text })`, for step hints the shell does
not draw yet); the playground sends `play` once the frame it shows is ready.
The frame still answers `pause` and `restart` (a restart carries a higher
generation, restores the store it had before the first cue and drops every
report from an older generation), but the shell no longer sends them. The
stage shows a frame only once it reports `ready`, keeping the previous one on
screen until then. Nothing moves on by itself: the visitor drives, and the
frame changes only when the next step lives in another frame, after the result
of the step before it was shown. The frame shown is the one named by the step in
progress (`useDemoHints` returns `beatIndex`; `useBeatPlayer` only loads it), so
a state earlier than one already reached is never shown again. Several steps can
share a frame, and then the visitor's own actions in the app move the scene
(Set up and Orchestrate are one frame each). Replay loads the group's frame in a
fresh frame and clears its progress. A pointer or key press inside
a frame settles its cues at once (`settle` in `createSceneDirector.ts` applies
every cue left and reports `complete`), so the scene never writes over the
visitor's changes and there is nothing to pause. Under reduced motion the
frame runs `prepare` and applies every cue before it reports `ready`, so it
opens on the timeline's final state (a working run ends finished). In a directed frame `sendTurn` is
simulated: it appends the user turn, runs the agent and streams a reply
through the same live text path, so a composer never reaches IPC. Sends and
answers share one `createReplyRuns` per frame: every run gets its own id, a
second reply for an agent waits until the first one ends (the agent stays
running in between), and a timer whose run is no longer active writes nothing.
Every reply, queued or streaming, and every other simulation (a run step, a
review fix, an Auto run) registers in the one run scope of `demoRunRegistry.ts`
and leaves it once its last cue lands. A simulated reply calls the send's
`onSettled` when it ends or is stopped, so sent plan comments turn addressed
only when their own reply finishes and go back to drafts when Stop ends it. A restart or a closed frame cancels the pending replies and
the whole scope before the director restores the store, and a timer from an
older generation writes nothing. Stop cancels the agent's runs through the same
scope, and
`useFakeTauri` keeps its fake boundary for the whole visit.

A directed frame also installs one demo IPC boundary before the scene mounts
(`demo/director/installDemoIpc.ts`). A scene's own handlers (`useFakeTauri`,
`mockIPC`) stack on top of it; the boundary answers settings from a local table,
accepts writes, answers a few list and status commands, and parks every other
read until a scene handler can answer it, so a seeded store is never wiped and
nothing throws. Commands that would leave the mock world (`git_push`, GitHub
writes, links, editor and Finder opens, chat replies) show a calm Demo playground
notice through the undo toast bridge instead (`demoExitNotices.ts`). A timeline's
`setup` swaps the store actions a flow needs for local simulations that change
the real store only as their simulated step lands: Auto start, approval, stop
and retry (`autoTimeline.ts`),
board cards (`installBoardActions.ts`), plan comments, diff notes, pins, Stop,
report and wireframe runs that always save a sample artifact (`installDemoWorld.ts`), review comment fixes from working to a
drafted reply that stays ready to publish, and Keep the draft on an edited
comment, which clears the change in place (`installResolveActions.ts`), and the
limits handoff, where Claude hits its usage limit and Codex finishes the same
brief once the visitor sends a message and the composer then shows the Codex
model (`agentTimeline.ts`, `limitsHandoffCues.ts`). The Auto frame tells the next
step of the same Harborline story: `autoStory.ts` fixes its goal (make every
webhook consumer idempotent across payments-api and ledger-core, with a replay
test), and `installAutoWorld.ts` replaces what the seeded run world says (two
payments-api branches, `hl/event-guard` and `hl/replay-tests`, and `ledger-core`
on `hl/event-guard`, no pull request yet, HBL-412 and its Sentry issue as the
only links, no earlier presets). The saved preset carries the run it came from,
so the Workflows studio lists 1 run (`installPresetActions.ts`). The limits
popover shows the share of each window used (`policyRows.ts`). `castAutoScene.ts` retells the delegations (Planner, Implementer,
Tester, a Ledger implementer on ledger-core and the Reviewer) and the replies
and notes come from `autoStory.ts`, so the shared u24 and c07 seeds stay as
they are. Work with an agent starts on a frame of its own, `demo-issue`
(`scenes/demo/DemoIssueScene.tsx`, `demoIssueSeed.ts`): the real shell with the
real Tasks studio open on HBL-412, fed by the Linear fixtures of the kickoff
brand scene, with the story's own session left out so the row offers Start
session. Pressing it runs the product's path: `pickIssue` fills the draft and
`goodboy:new-session` opens the real New session page with HBL-412 picked and its
description as the brief. Its timeline (`issueTimeline.ts`,
`installIssueStart.ts`) swaps only `createSession` for a local one that adds the
session with HBL-412 as its linked task and opens it; the agent start after it is
the simulated spawn every directed frame has. The rest of the group continues on
the `chat-shell` frame, where the same session is already linked to HBL-412. The
last Orchestrate step, Save it as a workflow, has a frame of its
own: `demo-run` (`scenes/demo/DemoRunScene.tsx`, `demoRunSeed.ts`) is the real
run page of an orchestrated run of the same goal, finished, with the Planner,
the payments-api Implementer and Tester and the ledger-core Implementer, because
Save as preset belongs to the run page of a workflow and an Auto run has none.
Its timeline (`presetTimeline.ts`, `installPresetActions.ts`) swaps
`savePhaseTemplate` for a local save that adds the preset to the workspace and
opens the Workflows studio a moment later, where it lands first in the list.
Find and Review tell the same story on the frames they already have:
`installStoryWorld.ts` casts the current session (the HBL-412 goal, its mounts,
tasks and pull request), `installBoardStory.ts` adds the board card's open
question, agent and transcript (`BOARD_STORY_SESSION` in `BoardScene.tsx`),
`libraryTimeline.ts` casts the library session, and `installReviewStory.ts`
renames the resolve session and sets its Linear and Sentry links. A step with a
`progress` line shows it in the header between its press and its result (Add
note, Start fix, the second press of the storage cleanup). The review step opens
`brand-diff-unpushed` (the branch is not pushed yet: "Not pushed, 5 ahead" and
Push 5 commits) and its comments are about this change, three of them (retry,
idempotency key, event id logging; `director/resolveStory.ts`, patched in by
`installReviewStory.ts`, with the diff the fix proposes). Push and publish
first preview the approved fixes and drafted replies from the simulated store
(`demoPublicationPreview.ts`) and then land: the replies are posted, the threads
close and the panel says so. Review and ship
ends in Settings, Storage: `demo-storage` (`scenes/demo/DemoStorageScene.tsx`)
is the real Storage page with the three safe worktree folders of older merged
Harborline branches (`hl/retry-credit-notes` 18 days and `hl/surface-retry-state`
24 days on payments-api, `hl/refactor-rate-table` 31 days on ledger-core) and one
folder in use; the story's own branches are not listed, as the pull request is
only pushed. Its timeline
(`storageTimeline.ts`, `installStorageActions.ts`) swaps `removeStorageFolders`
for a timed local removal that drops the folders and sets the outcome notice, so
the size in Storage falls. `&theme=dark`
now forces dark the same way `&theme=light` forces light, so a frame never
follows a stored preference.

Keys inside a frame: a directed frame registers `palette.open` (Cmd+K),
`search.open` (Cmd+F) and `column.toggle` (Cmd+B) itself, through
`scenes/useSceneShortcuts` (palette) and `scenes/useSceneSidebar` (the fold
state of the shell frames), since `App` and `useAppShortcuts` never mount in a
scene. When the focus is on the playground and not in the frame, `useDemoKeys`
hands those three chords to the stage, which focuses the frame and sends a
`shortcut` command; the frame replays it as a keydown for the same shortcut.
The wrapper's own keys (arrows, H, R) ignore a text field, and a frame that has
the focus keeps its keys to itself. Search answers from the simulated store
(`director/runDemoSearch.ts`: session goals and the visitor's messages), not
from the search index.

Studios outside the flows answer calmly instead of waiting: the demo boundary
answers the Impact aggregates, the starred issues, GitHub issue and PR lists,
the default branch, the monitor snapshot, the folder lookups and the search
index size (`demoIpcHandlers.ts`, `isEmptyRead.ts`, which only matches the
Impact queries and never a read that loads the sessions), and a directed frame
seeds a loaded Context for each session (`installDemoContext.ts`) and a quiet
Monitoring snapshot (`installDemoMonitor.ts`). Start on a plan, and any next
step that spawns an agent, runs `createSimulatedSpawn.ts`: it adds the agent to
the session, opens it and streams a short reply, and a timeline that has its
own spawn (Auto) keeps it for its session.

A group carries an ordered list of hints (`demo/hints/`, typed in
`demoHintTypes.ts`), and each one is a step: an id, a `label` (the rail), the
`copy` (the coach mark), the `instruction` (the header), the `result` (what the
header says once it is done), the `beat` (the frame it needs), an anchor, a
preferred side and two checks, reveal when and done when. The anchor is a
selector inside the frame (an existing `aria-label` or role, or a
`data-demo-anchor` that only the demo reads), and the two checks read the real
store and DOM of the frame. Once a frame is ready the stage sends it `hints`
(the group id and the ids of the steps already done); the frame's
`createHintEngine` re-measures on store changes, DOM mutations, scroll and
resize in one animation frame and works on one step only, the first one not yet
done, in the authored order: it reports `anchor` (that step, with its rect, or
`isOffscreen` when a scroll container or the viewport hides it) and `tried`
(its done check held after its reveal check did). A later step is never lit,
never armed and never credited early, and a press on a later control counts for
nothing. The done check compares against the store as it was when the reveal
check first held, so data a scene seeds after the engine starts never counts as
the visitor's action; a reveal check therefore waits for its control to render.
Reports carry the frame's generation and the stage drops any from an older
generation or another frame. A frame that reports `ready` again (it reloaded)
loses its note, and the stage sends it `play` and `hints` again. The stage
draws one note beside the anchor through the stage scale, a 2px outline and a
callout on the side of the lit region with the most room, inside the stage
(`hints/placeCallout.ts`; the hint's side only breaks a tie); only the callout
takes clicks. The callout touches the 4px outline with a 6px gap and never
overlaps the control or the rects the last press opened (`opened` on the anchor
report, `avoid` in `placeCallout`); `hints/coachPlacement.test.ts` measures the
callout against the target for every hint of every group. The note goes away as
soon as the visitor presses that control (`isPressed`, the press on the very
element the hint anchors; a click that only focuses the composer keeps it), so
it never covers what the control opens; a step with two presses names the
second one in `progressCopy`. A control
scrolled out of view gets a note at the bottom of the stage with Show control,
which sends `reveal` so the frame scrolls it into view once. The coach X and
Escape dismiss only the open hint (`dismiss` in `useDemoHints`; the next step
shows as usual) and H brings it back. Only Hide hints and Show hints in the top
bar turn every hint off, and the choice is kept in the tab. There is no Skip, as
a step the visitor did not do would break the story after it.

The header line (`hints/headerInstruction.ts`) is always what to do now: the
step's `instruction`; once the step is done, its `result` for at least 2.5
seconds (`hints/resultDwellMs.ts`, the engine's dwell; a hint whose result needs
reading sets `dwellMs`, 3.5 to 4.5 seconds, read through `hints/dwellOf.ts`:
the waiting card, Follow a helper, Add note, Push; and its optional `settle`
runs once after the dwell, as closing the limits popover so the composer takes
the first click) and until the control of
the next step is on screen, so a result is never replaced by an instruction
for a control the visitor cannot see yet; when the group is done, "<group> is
done. Go on with <next>, marked Up next." The line never goes back to a
description of the scene, and it never says a step is done before its result is
visible. The frame shown changes after the result was held, and only if the
next step lives in another frame. Simulated replies speak as the agent on the
sample project and never mention the app or the demo. Progress is the list of
done steps per group, kept in `sessionStorage` under `goodboy-demo-hints`
(every read and write survives blocked storage), so a new tab starts fresh,
and Replay clears the open group only. Replay bumps the group's `epoch`; a mark
made against an older epoch is dropped, so a stale tab cannot bring a replayed
group back. A `tried` report is accepted only for the step that is next, in
`useDemoHints`, as well as in the engine. Every group has its data file:
`onboardingHints.ts`, `agentHints.ts`, `orchestrateHints.ts`, `findHints.ts` and
`reviewHints.ts`. `data-demo-anchor` marks only controls with no stable name:
the setup buttons, Start session on a task, the Start button of the New session
page, Auto's Approve plan, Start fix and the storage Remove button. Every group is walked to
its last step in a test.

While a hint points at something on screen, the stage dims and lightly blurs
everything except the context of the step (`DemoSpotlight`): one `bg-surround`
layer at 50 percent with `backdrop-blur-xs`, cut by a single rounded SVG mask,
so there is no seam. The hole is the control plus its region, padded by 8px
(`hints/holeOf.ts`), drawn inside the coach layer, never taking a click, faded
in only when `canAnimate` allows. The frame reports the region as `focus` on
the anchor report. A hint names it with an optional `focus` selector, resolved
as `anchor.closest(focus)`; without one `director/focusRegionOf.ts` takes the
nearest ancestor that is a form, section, list item, dialog, group or bordered
and rounded surface, then, failing that, the nearest wide short band (a page
header or toolbar), as long as it is bigger than the control and under 60
percent of the screen. No region means the control alone. The callout is placed
beside the hole, not the control, so it never covers what is lit, and it is
never dimmed. A control below the fold or cut by an edge is scrolled to the
centre of its pane once per hint (`scrolled` in `createHintEngine`) before it
is lit, and the report follows scroll and resize, so the hole stays aligned.
A hint with no visible anchor (a control that could not be
scrolled in) never dims, and offers Show control. The frame reports `isClicked`
once the visitor pressed the control, and the spotlight and the note lift then,
and on Escape or when the step is done. While it is on, only the secondary
chrome recedes to 65 percent (`quietClasses`, `data-quiet`): the rail rows other
than the open group and the next one, the version chip and the link back to the
site. The group title, its instruction, Up next and the coach
mark stay at full strength, and hover or focus brings a quiet row back.
A step is done only once its result has been shown. When a step is done,
`createHintEngine` holds the next one for 2.5 seconds
(`hints/resultDwellMs.ts`) and reports no hint, so nothing dims and no callout
moves while the result is read; the wait grows while the pointer keeps moving
over the result, up to 8 seconds, and a pointer that stopped does not hold it.
A reset never waits. `director/createResultTracker.ts`
finds the result: what appeared in the 450ms after a trusted press (a popover
portal whose wrapper has no height counts through its visible children), kept
until the visitor presses somewhere else or it closes. The next hint's hole is
the control, its region and the open result (`director/unionOf.ts`); when that
covers more than 60 percent of the stage (`hints/isHoleTooBig.ts`) the hint
shows without a spotlight instead of dimming the result. The engine never
scrolls to the next control while a result is open; Show control still does.
Hints never take focus. After
a press, the demo frame ignores a programmatic `focus()` on the composer for
3 seconds unless the press was inside the composer, so the opened view keeps
focus (the real app focuses the composer on opening a helper; that stays in the
app and is refused only in the demo frame).
A group switch answers at once: the rail row is selected, and `DemoStageLoading`
covers the stage until the new frame reports ready, whether it is the first one
or a switch. It names what is loading (the frame's `label`; `StageFrame.label`).
The frame the next step needs is loaded in advance (`preloadBeat` in
`useBeatPlayer`, from `nextBeatIndex` of `useDemoHints`), so a frame change after
a result is a swap. Hovering, focusing or pressing an open group row preloads
that group's opening frame instead, and a finished group preloads the next one.
In the demo the Goodboy menu never opens itself after the first task, the chip
stays at rest and the menu holds no setup checklist (`isDirectedScene`).
In a directed frame `answerOpenQuestions` is simulated too: it marks the
answer, keeps the unsent draft and streams a short acknowledgment.

Set up runs the real wizard end to end. `scenes/onboarding/setupSceneAnswer.ts`
answers the folder picker with `~/Code/harborline` (payments-api, ledger-core,
notify-relay) after a short delay, the git checks and a committed
`db_transaction`, so Create goes through the real `createWorkspaceWithFolders`.
`seedWizardScene` signs in a detected agent on Sign in, keeps the new workspace
on `setCurrentWorkspace` and starts the first task through
`startSampleScout.ts`: it seeds a Scout session, appends the visitor's prompt and
streams a reply picked by `sampleScoutReply.ts` (the bug starter finds the
retried webhook that posts a second credit and names HBL-412, the issue the
next group starts from), and `OnboardingScene` shows that session in the app
shell once the wizard closes. The Linear issues the wizard lists are Harborline's
(HBL-412 first); Draft the brief, which the app answers with a session draft,
starts the same sample Scout on the issue (`openSessionDraft` in
`seedWizardScene`). A directed `OnboardingScene` reopens the wizard on its
first-session step when it is closed with no session (Skip, Set up later), so
Set up never ends on an empty page. The reply runs on
`sampleScoutRuns`: Stop cancels its timers and marks Scout stopped, so a
stopped run never ends in the setup done note, and leaving or reseeding the
scene cancels them too. On Your tools, Connect adds a mock account
(`connectDemoTool.ts`, through `InstantToolConnectContext`) instead of opening
the key form, the way Sign in works for agents.

The Settings frames of the default shell are `settings-general-pinned` and
`settings-providers-rail`; they live in `scenes/u21/settings.tsx`. Each mounts `audit/AppFrame` and opens
Settings through the store, so the column, the rail and the page behave as in
the app. Settings replaces the sidebar with its own column, so the General page
has one scene, not one per sidebar state. `settings-providers-rail` folds the
sidebar first and seeds Claude near its limit to show the dot and the notice on
its page.

The dense capture fixtures are `rules-teleport`,
`rules-no-limits`, `rail-ticket-ids`, and `activity-groups` (it opens the finished
run's `6 steps` count row and then a `subagents` count row). The resolver
fixture uses `fix-run&live=1&pane=transcript`; add
`&flow=recheck` or `&flow=follow-up` for its other starts. It builds the
provider message with the production kickoff and handoff builders and leaves
the resolver waiting for its first reply. Settings scenes install browser
responses for Backup previews and permission lists, so those pages do not
need a Tauri runtime.

Scenes that share one seed live in a folder, with one file per scene, a
`fixtures.ts` for the data and a `seeds.ts` that writes it into the store.
`scenes/flow-audit/` covers the workflow builder, a workflow run, the open
questions cluster, the transcript and the command palette over one Harborline
session. `?scene=open-question-prose` shows one blocking question the agent
asked in prose, with an answer written under it and **Send as message** beside
**Answer** (`scenes/flow-audit/OpenQuestionProseScene.tsx`).
`?scene=workflow-run&run=parallel` shows the same run earlier, on its
first step: three scouts working side by side, one done, and the orchestrator
waiting on the step (`scenes/flow-audit/parallelRun.ts`).
`?scene=workflow-run&run=finished` shows the run done, with every step complete
and no NOW (`scenes/flow-audit/finishedRun.ts`).
`?scene=workflow-run&run=plan-hold` shows it as a custom run held in Ask after
the plan, with **Review plan** in the header, **Approve plan** in its menu and
the **Guidance** tag on the steps the standing guidance went to
(`scenes/flow-audit/planHoldRun.ts`). The same file seeds the orchestrated
hold behind `?scene=workflow-run-plan-review` (the plan drawer open over the
page) and `?scene=workflow-run-plan-question` (the planner asked, the strip
says what), and `?scene=workflow-run-scrolled` scrolls the steps 40px so the
edge line shows (`scenes/u21/run-page.tsx`).

The README and feature-area guide docs are captured from these scenes. The
`brand-*` scenes in `scenes/brand/` tell one Harborline story (issue HBL-412,
branch `hl/fix-duplicate-credit`, payments-api #318 and notify-relay #57, with
ledger-core only read), and `scenes/brand/canon.ts` holds the names and numbers
every picture shares. Add `&brand=1` to skip onboarding and hide the toasts a
browser tab raises. The README images live in `docs/readme/`, the
feature-area guide ones in the public
[goodboy-media](https://github.com/akhayam99/goodboy-media) repo, both as dark
and light `.webp` pairs. The README hero is also the website's hero picture,
the one capture on the site; every other product view there is a React mock.
`pnpm readme:hero` shoots the `readme-hero` scene (the Harborline session on
its Overview with the Projects card unfolded, the shared Context drawer open
and three runs interleaving in Activity) from the desktop mock dev server
(`http://localhost:5230`, or the URL passed as its first argument) at
1920x1200 and scale 4, in both themes. It writes
`docs/readme/readme-hero-{dark,light}.webp` at the full 7680 px and
`website/public/hero/hero-{dark,light}-{1208,2416,3624}.webp`, 1, 2 and 3 times
the width the site draws it at, cropped to the top 840 px of the window and
resampled once from the same capture. To crop a short surface, use a `--window-size` height shorter than 900. The layout keeps its own proportions and the footer stays pinned.

The scenes listed in `FRAME_SCENES` (`scripts/validateScenesFrame.mjs`) are also measured by the scene job at three window widths, so changing their layout can fail the frame probe: [testing.md](./testing.md) → Frame probe.

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
- The frame has a 16 px radius. The clip inside it takes the larger of 8 px and
  the frame radius minus the frame padding and its 1 px border, the same rule as
  `--r-shot` in `website/src/styles.css`. Frames drawn before this rule keep the
  old radii until their file is captured again.
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
- `--hover "<css selector>"` moves the pointer to the center of the first match, after the clicks and before the capture. It shoots a tooltip or a hover card the scene does not open by itself, such as the limits card of a provider chip in the top bar (`--hover '[aria-label^="Claude limits"]'`).
- `--scroll "<css selector>"` scrolls the first match to the top of the window, after the clicks and before the capture. It shoots a pane the scene stacks below the first screen, such as the studio home under the workflow builder (`--scroll '[data-studio-overlay]'`).
- `--version x.y.z` names the version the manifest records for the figure. Without it the shot takes the version of `apps/desktop/package.json` of the checkout that runs the script.

Each feature-area guide points at each file with its raw URL,
`https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/<name>-dark.webp`.
Pictures live outside this repo so each reshoot does not grow its history:
push the new files to goodboy-media first, then the text here. Reusing a name
replaces the picture in place, within the five minutes GitHub caches it.

Every figure has one caption line under its `<picture>`, after a blank line:
`<sub>Screenshot from Goodboy 0.23.0</sub>`. `docs/figures.json` is the one
source of that version, keyed `features/<name>` for a guide figure and
`readme/readme-hero` for the README hero. `pnpm features:shots` and
`pnpm readme:hero` write the entry when a capture ends, with the shot args as
its `recipe`, quoted so a POSIX shell reruns it as typed, so re-shooting a figure moves its version and a figure left alone
keeps the version it was shot at. A trial shot under a name no guide uses adds
an entry no picture uses: delete it, because `pnpm run check:doc-refs` fails on
it. The same check fails when a figure has no entry, when a caption differs
from its entry, or when an entry is newer than the repo version.
`node scripts/check-figure-versions.mjs --write` rewrites the caption lines from
the manifest. In a worktree, `../goodboy-media` does not resolve: set
`GOODBOY_MEDIA_DIR` to the checkout of goodboy-media.

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
  converts through `cwebp -q 80`. A taller element grows the window to fit, so
  a column can be framed alone with its own width and height. A scene without `[data-shot]` is captured
  whole instead, at a 1360×850 window and DPR 1, so the picture keeps the same
  size. Extra scene params ride in the scene argument
  (`'session-start&kind=workflow'`), and `GOODBOY_SHOT_URL` points the script
  at a dev server on another port. `GOODBOY_SHOT_WAIT` (milliseconds) lengthens
  the render wait, and `GOODBOY_SHOT_BLUR=1` drops focus before the capture so no
  focus ring or tooltip shows.
- **Both themes, one command each.** The script captures dark and light in
  one run; a scene that renders differently per theme needs no extra work,
  the `&theme=` query param already switches it (`MockScene/index.tsx`).
- **Timing.** A PR that changes an existing screen photographs the scene on
  `main`, before the change, as `-before-`; after the change, the same scene,
  same name, as `-after-`. A brand-new screen only ever gets `-after-`: there
  is nothing to be "before".
- **Promotion at the version bump.** The `next` folder under `docs/changelog` holds
  work-in-progress pictures across PRs in the same release. The PR that bumps
  the version numbers renames the `next` folder to `docs/changelog/<version>/` and sets
  `image=<name>` on the entry. `changelogImageBudget.test.ts` then checks
  names, complete dark/light pairs, that a `before` has a matching `after`,
  at most 12 images and 2 MB per release, and no orphan file.
- **Retroactive from the release's own code.** A release that already
  shipped can gain pictures, but never capture today's app under an old
  entry's name: the picture would show a screen the release never had.
  Capture `-after-` from a checkout of that release's tag and `-before-`
  from the previous release's tag. The app loads pictures from `main` first
  and falls back to the tag, so files committed after the tag still show.

Task-link controls have three scenes: `task-links` for idle chips and visible
branch placement, `task-links-hover` for keyboard focus revealing unlink, and
`task-links-undo` for compound unlink with the Undo toast and Activity Re-link.
They use the real overview, chip and placement components in both themes.

The sorted scene list is committed at
`apps/desktop/src/app/components/MockScene/scenes.txt`. The registry discovers
scene maps exported from the numbered scene folders automatically. A duplicate
id reports both source files. An unknown scene id shows an alert and nearby ids;
omitting the scene parameter opens the workspace.
