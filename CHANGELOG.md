# Changelog

Release notes for Goodboy, newest first. `.github/workflows/release.yml` reads
the section for the version being tagged and uses it verbatim as the GitHub
release body and the in-app updater's notes. Add the entry for the next
version in the same PR that bumps the version numbers (see
`docs/release-command.md`), before the tag is pushed: the release build fails
if it can't find a matching `## Goodboy vX.Y.Z` heading.

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
