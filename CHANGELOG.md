# Changelog

Release notes for Goodboy, newest first. `.github/workflows/release.yml` reads
the section for the version being tagged and uses it verbatim as the GitHub
release body and the in-app updater's notes. Add the entry for the next
version in the same PR that bumps the version numbers (see
`docs/release-command.md`), before the tag is pushed: the release build fails
if it can't find a matching `## Goodboy vX.Y.Z` heading.

## Goodboy v0.1.59

Approving a pull request and replying to an issue both happen here now, a queued resolution never closes a thread nobody settled, and a workflow stops walking past a question nobody answered.

### [#1209] Approve or request changes from the pull request panel

The GitHub pull request panel rendered the whole PR and could merge, close, reopen and toggle draft, but it had no verdict control, so approving meant leaving for a browser tab. A Review action now sits in the same bar: approve, request changes, or comment, with an optional summary. It shares in-flight state with the other writes, so nothing else fires while a review posts, and it is hidden on merged and closed PRs where a verdict means nothing. One thing had to be fixed before it could ship: the publish path resolved its target from the session's first linked pull request rather than the one on screen, so in a session with more than one PR a verdict would have landed on the wrong one. The panel now passes the PR you are looking at. Note that submitting a verdict also publishes any review drafts staged in that session, which is how the publish path already behaved.

### [#1210] Read and write a GitHub issue conversation in place

A GitHub issue showed its title, state and description and nothing else. Its conversation was invisible, and no issue in the product had a composer at all. The issue detail now carries a Conversation tab with the full thread (author, date, markdown body) and a composer at the bottom that posts back to GitHub and reloads the thread. When a post fails it keeps what you typed and shows what GitHub returned. This is the first issue comment you can write from inside Goodboy. Linear, GitLab and Sentry issues stay read-only for now.

### [#1211] A review thread never closes on a verdict nobody gave

A queued resolution carrying no verdict was read as a fix, so the thread was resolved on GitHub. Every row written before the verdict column existed carries no verdict, so this was reachable rather than theoretical. An unknown verdict now posts its reply, leaves the thread open, and says so in the toast. Three more fixes on the same path: a batch that hits an error keeps going instead of abandoning every thread after the first one and still refreshes what it did close, a rejected push no longer marks items failed that never needed the push, and the three paths that delete queued resolutions can no longer run at the same time and post the same comment twice.

### [#1212] A blocked workflow says so at the button

The open-question gate stopped a workflow from marching past a question nobody answered, but enforcing it was left to each caller, and three manual start paths walked around it. Both run start buttons now carry the blocked state at the action itself and route through the same confirm the next-step action already used, so starting anyway is a deliberate second click. Starting a step agent refuses an unconfirmed start of a blocked run instead of relying on the caller to have checked. Engine-level enforcement, where the gate lives inside the store action rather than the buttons, is still ahead.

### Smaller fixes

- [#1208] A linked GitHub issue opens the issue instead of landing in the pull request pane
- [#1208] External links go through one shared open path rather than raw anchors that a webview may not honor

## Goodboy v0.1.58

Deleting a session no longer leaves an orphaned worktree behind, a new Storage section lets you see and reclaim what archived sessions cost on disk, the issue-to-PR loop closes on GitHub and GitLab alike, and Linear and GitLab issue descriptions get the same in-app editor GitHub already had.

### [#1202] Deleting a session cleans up its worktree, every time

Deleting a session could fail with "Directory not empty" when a dev server was still running inside its worktree: git de-registered the folder anyway and it stayed on disk forever. Closing a session now kills every process in its terminal session, not just the shell, waits for the terminals to close before touching the filesystem, retries the removal and falls back to deleting the folder directly if it still won't budge, and reports the path if it truly can't. On startup, folders git or the app lost track of are found and offered up for cleanup, never removed automatically.

### [#1203] See what archived sessions cost on disk, and reclaim it

Settings gets a Storage section, above the danger zone, showing the database size and how much archived sessions' transcripts and worktrees add up to. Two explicit actions, each confirmed twice: prune archived transcripts (deletes their `turn_events` rows and vacuums the database so the file actually shrinks; the chat view of an unarchived session comes back empty, though the session's own messages stay in the database) and remove archived worktrees (drops the folders and keeps the branches, so a worktree can be recreated later). Nothing runs on a timer, nothing runs automatically.

### [#1205] The issue-to-PR loop closes on GitHub and GitLab

An issue linked to a session after its pull request was already open never got a `Closes #N` line, so it never auto-closed. Linked issues now get a "Link issue" action that adds the reference to an already open PR. On GitLab, a work item now also completes when its merge request merges, matching the behavior GitHub already had.

### [#1204] Edit a Linear or GitLab issue description in place

GitHub issue descriptions became editable in-app in the last release. Linear and GitLab issues now get the same editor, writing straight back to the provider.

### [#1200] A resolver's verdicts survive a restart

Restarting the app used to wipe a resolver's decisions on a review thread, and the "no verdicts" warning would blame the agent for threads it had actually resolved. Verdicts are now rebuilt from the session transcript on load, so a restart no longer loses them.

### Smaller fixes

- [#1201] The "update available" chip pulses three times, then rests, instead of forever
- [#1198] Spawning a resolver shows a status dot instead of a spinner

## Goodboy v0.1.57

One visual grammar across every screen, a provider you connect in one click, diffs side by side, and the round where a workflow's orchestrator stopped hiding what it decided.

### [#1174] One grammar for every lens

The integrations lens, the inspector and the workflows lens had each grown their own way of drawing a header, a row and an empty state, so the same idea looked different depending on where you found it. They now share extracted primitives: agent cards come down to three tiers, the explore tree is a tree again, history stops crowding the present, and a pulsing dot means something is actually running rather than decorating a finished card. Creating something no longer yanks you somewhere else, and navigation is an explicit choice instead of a side effect. The theme toggle is back in reach, prose in a list has one answer, and the resolver panel is readable: replies follow a contract, comment previews stop showing their raw source, and control markers no longer reach the screen.

### [#1175] One rhythm for every pane, one click to connect a provider

Every pane measure is centred inside its surface, the chat header lines up with the transcript, the workflow builder and the provider studios sit on the shared rhythm, each region has exactly one scroll owner, and every studio panel has a real heading. Connecting a provider used to mean a terminal and a copy-pasted command: it is one button now, backed by a per-provider state machine that probes real auth, injects its own login env, opens the most auth-shaped URL it sees (never a docs link, and never an unsafe one), reads the URL across PTY chunk boundaries, and keeps probing after the login process exits. The inbox is told when a provider connects. Dates and money are formatted at one pinned locale and one precision, so the same number reads the same everywhere, and a GitHub or GitLab issue opens in full inside the session pane.

### [#1177] The orchestrator says what it decided, and who decides next

The run pill contradicted the strip, the card said "running" three times, and a run stuck on a failed step stayed frozen. The strip is rebuilt around a derived state ladder, a run gets a generated title and can be renamed from its header, lifecycle actions live in the detail header, and open questions surface even under autorun. Spend is charged to the run that made the decision rather than a faked turn, with the orchestrator's own telemetry kind, and a run records why it stopped instead of leaving you to read it off the copy.

### [#1179] One detail grammar, one diff geometry

The GitHub, Linear, Sentry and GitLab detail panes each carried a right-hand column that squeezed the content and left the labels misaligned; the properties now live in the header band as one grid, which is also what aligned the studio and session panes. The split diff had columns sized by their content, so every file came out a different width with stray horizontal scroll: both sides are exactly half now, rows wrap, and the layout is identical from file to file. The `@@ -15,15 +16,15 @@` hunk header is replaced by what it actually means, `Lines 16-30 · in export const FlowProvider`.

### [#1178] A resolution reply has a shape

A resolver's reply on a review thread is now wrapped by the app itself: the verdict, your explanation, and the resolution with a link to the commit that carries the fix. The model writes only the middle, so nothing states the outcome twice.

### [#1180] Fable stays at the top, off the coding roles

A workspace that pointed a coding role at another provider's model could be substituted onto Fable when the run landed on Anthropic, because the substitution picks the strongest model in the same cost tier and Fable outweighs Opus. It still does, and the escalation paths that depend on that ordering are untouched. Fable is marked as a thinking model instead, and the substitution skips it for anything but a role that only thinks.

### [#1181] The pull requests a session actually has

The session's code-host pane offered one CTA, "open in code host", even when the session had a pull request. It lists every pull request on that branch now, with its state, the one you are reading marked, and a click to switch between them.

### Smaller fixes

- [#1174] Reaching a resolver's diff no longer needs the inspector, and the shortcut stops claiming a file while it is still loading
- [#1175] The overview skeleton matches the pane that replaces it, and the issue inbox skeleton no longer grows unbounded
- [#1177] A step summary gets a 60s budget and its child is killed on timeout, with the retry running against the original output
- [#1177] Toasts moved to the top right, under the bell, and stay above the panels they warn about
- [#1179] A refused model pick is notified instead of silently ignored
