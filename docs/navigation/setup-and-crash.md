# Bug sheet, setup and boot

> **Read this when** you change how a bug is filed, what happens after a crash or a frozen window, the first-run setup, or what the window shows while it boots. **Not for** Home and the New workspace form ([home-and-drawer.md](home-and-drawer.md)) or the setup card's place on the Board ([features/board.md](../features/board.md)).

## The sheet

One sheet files every bug. `ReportSheetHost`
(`features/bug-report/components/ReportSheetHost`) floats it at the bottom of the
window, centred, with no overlay, so the page stays live. Opening it reads the screen
you are on before anything moves, so Settings stays open under it.

Doors: ⌘I from anywhere; Report in the rail foot
(`app/components/ShellLeft/ReportBugButton.tsx`); Report a bug in the palette (also
answering bug, issue, feedback, crash and broken); **Help > Report a Bug** in the
macOS menu bar (`app_menu.rs` emits `goodboy://menu` with `report.open`, replayed by
`useMenuCommands`); Report this error on a warning or error notification, which
attaches it.

- **One line is the title**, where the cursor starts. ⇥ or Add detail opens a longer
  field, ⌘↵ sends, Esc closes; both stay in the `bugReportDraft` slice until sent.
- **Every attached part is a chip**: version and build, system, screen, CLI
  versions, and the notification or error when there is one. A chip's × leaves it
  out; the dashed chip puts it back.
- **What gets sent** opens the exact text that leaves, with the count of redactions
  and the list of what never leaves.
- **The button says where it goes.** With GitHub connected it is Send, filing through
  `gh` under your account, the toast linking it; while you type, a matching open issue
  shows above the chips with Add mine there, which comments instead. Without GitHub
  it is Open on GitHub, a prefilled link, the full text going to the clipboard first
  when it does not fit.
- The titles Report this crash, Report this error and Report this freeze have one
  source, `NAMES`, read by the sheet, the notification row, the crash screen and the
  startup screen.
- **Crash and startup failure.** The crash screen shows the sheet inline under the
  error, with the error and our stack frames attached and the line `Crash: <kind>`;
  the startup error screen opens it with Report this error. Neither needs the store.

### After a crash the app could not show

An uncaught window error or a panic leaves `~/.goodboy/last-crash.json`. The next
launch shows one persistent toast with when and where (Goodboy closed unexpectedly
last time, after a panic; Goodboy hit an error last time, when the window kept
running). Report it opens the sheet as Report this crash or Report this error with
the error and the last action names attached; Dismiss deletes the record.
`LastCrashBridge` claims the record, so one window shows it.

### A frozen window

1. Each window calls `window_heartbeat` every 5 seconds (`useWindowHeartbeat`,
   mounted by `LastCrashBridge`), saying whether it is visible.
2. A Rust thread (`window_heartbeat.rs`, release builds only) checks every 2
   seconds.
3. A window that showed itself and has been silent for 30 seconds is written once to
   the same `last-crash.json` as kind `freeze` ("The window stopped answering for 47
   seconds"), unless the record holds one not shown yet.
4. When the beats return the reply says so, and the window offers it at once ("Goodboy
   stopped answering", Report this freeze); if the app closed while frozen, the next
   launch offers it.

A hidden, minimized or closed window is never counted, nor a gap in which the
machine slept: the thread notices its own tick, or the wall clock against the
monotonic clock, jumped, and restarts every window's count. On Windows the monotonic
clock may count through a sleep, so only the tick catches it. Nothing leaves the
computer before you press Report it.

## First-run setup

A full-screen wizard in one shell that never moves: a header with the lockup (a 22
px `BrandTile` and the word), a labelled three-step stepper (Agents, Workspace,
First session) and Set up later; one 600 px column whose title starts on the same
line every step; the step's own actions inline at its end (Back and the primary,
right-aligned, no divider; Skip on First session only).

- Steps crossfade in one grid cell (240 ms, 80 ms of opacity with reduced motion),
  actions disabled meanwhile. Bodies render through `WizardStepBody({ step, nav,
wizard })`; `nav` (`WizardNav` in `wizardSteps.ts`) carries `goNext`, `goBack`,
  `goTo`, `finish`, `later` and `setBusy`.
- Escape goes through the escape stack: an inner layer first, else one step back; on
  Agents and on a resume's first step it does nothing, and it never ends setup.
- Set up later writes `onboarding.wizard = later`; entering a step writes
  `onboarding.step`. A relaunch with setup open reopens there, in the main window
  only, on Workspaces (`resumeStep` falls back to Workspace when the step needs a workspace
  that is gone). The palette offers Resume setup while paused.

### The steps

1. **Agents**, headed "Welcome to Goodboy" with one sentence and the trust line; no
   splash step, and agent detection starts here. One row per sign-in CLI (Claude,
   Codex, Cursor, Gemini) with its real state: Ready with version and account, Not
   signed in with Sign in, Not installed with the exact install command and Run,
   Can't start with the CLI's output and Check again. Rows recheck on window focus,
   when a sign-in or install terminal ends and on Check now, one agent at a time
   (`useAgentDetection`, `probeAgent`), dropping an older check's answer. Continue
   needs one ready agent (`readyAgents()`) and saves the default (`agents.default`),
   which the new workspace takes as its default provider. API key providers sit
   behind Use an API key instead.
2. **Workspace** is `NewWorkspaceForm` in first-run mode
   ([home-and-drawer.md](home-and-drawer.md#starting-a-project-from-nothing)). There
   is no permissions question: every workspace starts on Full access.
3. **First session** is one input card: three starters naming the folder, the agent,
   Scout reads only and the model as pills, and Start, which starts a Scout session
   from a draft (`startSessionFromDraft`). Setup is done only once that resolves; a
   failure keeps the prompt and reads Retry. With a task source connected, Pick up an
   issue lists assigned issues and Draft the brief opens the draft with one picked.
   The draft carries the first folder, so the session lands in it.

**Tools** holds Code and Tasks on an unnumbered step, reached from First session's
Connect Linear or Jira row (`goTo` tools); Back, Continue and Escape return to First
session (`numberedStepOf` keeps it current). The host the first repository pushes to
leads, the others fold under Other code hosts; with no repository Code says why
while Tasks still works. Continue with nothing connected is the skip, and every form
binds to the workspace the step opened for. Sentry, Slack and the rest live in
Settings › Integrations.

### The setup card

The Board's setup card (`features/onboarding/SetupCard`, on the board and the empty
board until setup is finished or hidden) has the stepper's three rows, counted by
`setupProgress()` (`features/onboarding/setupProgress.ts`), the one function it reads
("Setup · 2 of 3").

- About you is not counted; it is suggested under Next after the first session.
- While setup is open or paused a row resumes it at its step.
- The first session ticks when an agent finishes a turn, not when a session row
  exists.
- Old checklist ids map on hydrate (`savedWizardStepOf`): a saved Tools step resumes
  at First session, a Welcome step at Agents, and a stored tools entry counts for
  nothing.

## Boot

The splash is the tile, the name, a 160 px determinate bar and the phase word on the
setup backdrop. The bar moves one sixth per real `bootPhase` write
(`BOOT_PHASE_ORDER`, `bootProgressPercent`), never on a timer, jumping under reduced
motion. Settings, agent credentials and workspaces load together, so the word shows
the first still loading and never steps back.

1. Once the launch knows its workspace, `showLaunchShell` sets `isShellReady` with
   that workspace current and `boardReady` false.
2. `App` mounts the real top bar, the places rail, the Board (`BoardSkeleton` lanes)
   and the tool rail, so the palette and the workspace switch already work.
3. The cards replace their skeletons in the one commit that sets `boardReady`; no
   empty state ("No sessions yet", "Add a folder first") draws before it
   (`empty-before-loaded.test.ts`).
4. The last session opens in place, its parts swapping from their skeletons; idle
   loads come last.

- A launch with no workspace mounts the launcher or the setup on `ready`. A failed
  launch, before or after the shell shows, puts the error screen back
  (`AppBootSplash`, on `bootPhase === 'error'`), and Retry hides the shell until the
  next workspace is known. The `boot-shell` scenes show the three states.
- `BootSplashExit` crossfades the splash out over 200 ms on top of the shell (same
  `BootStage`, so the tile stays put), with no fixed wait; reduced motion removes it
  at once.
- The window opens hidden and `useRevealWindow` shows it after the first paint (Rust
  shows it after 3 s if the page never does), so a light theme never flashes dark.
  Before React, `index.html` paints the same chrome and tile in both themes, and the
  native background is the dark chrome `#0d0e10` (`boot-shell-paints-the-chrome.test.ts`
  pins both to `styles.css`).
