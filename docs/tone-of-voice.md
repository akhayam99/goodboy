# Tone of voice

> **Read this when** writing any user-facing string: README, website,
> release notes, in-app copy, error messages. **Not for** repository language
> outside product copy (see `CONVENTIONS.md`) or visual layout and typography
> (see `DESIGN.md`).

How Goodboy talks. If a human reads the string, these rules apply. That
covers the README, the website, release notes, in-app copy and error messages.

## The shape

Write like someone who's been in the trenches with the reader, not a brand
talking to a market. There are two voices:

- **Product voice** ("Goodboy does X"): direct, second person, concrete.
  README, feature sections, in-app copy.
- **Author voice** ("I built this because…"): first person, conversational.
  Only for the founder note and release blog posts. It never leaks into
  product copy.

## Rules

### Words to avoid

- **"AI"**. Say `agent`, `model`, `Claude`, `Codex`, `Cursor`, `Antigravity`, or the
  specific behavior.
- Fluff: **"powered by"**, **"intelligent"**, **"smart"**, **"seamless"**,
  **"revolutionary"**, **"blazing fast"**, **"next-gen"**.
- Minimizers: **"simply"**, **"just"**, **"obviously"**, **"basically"**.
- Sales-deck verbs: **"unlock"**, **"empower"**, **"leverage"**,
  **"streamline"**. Use the actual verb.
- Empty superlatives: **"enterprise-grade"**, **"world-class"**,
  **"best-in-class"**. Be specific or stay quiet.

### Neutrality

- **No single-provider assumption in chrome.** Chrome is the app's frame:
  launch screens, empty states and headers. It never talks to the user as a
  Claude session or hints that Claude is what runs underneath. Name a provider
  only where the copy is really about it (a Claude error, a Codex setup step).
- **No hardcoded user nickname.** If a greeting needs a name, it reads it from
  the user's profile, never from a constant. If in doubt, drop the greeting.
- **Brand names keep brand casing, mid-sentence too.** "Sign in to Claude",
  "Install Codex", "OpenRouter". Provider names come from `PROVIDER_LABEL`.
  There is no lowercase variant.
- **Product copy is in English.** That means every label, placeholder, empty
  state, tooltip and button. A new string in another language is a bug:
  translate it.
- **Don't leak a contributor's assistant config.** A local setup can carry
  nicknames, casing, a house style and chatty language. In a mock or a PR, any
  of these is a bug: strip them.

### Punctuation

- **No em dashes.** Period, comma, colon or parentheses instead.
- **One sentence per idea.** Don't chain three clauses with semicolons.
- **Sentence case** for headings. Not Title Case. The one exception is the
  casing of tiny eyebrow labels, and [DESIGN.md](../DESIGN.md) owns it in
  Voice & copy.
- **Chips, statuses and toasts use sentence case too.** One set of status words
  across artifacts, inbox and resolve: "Generating", "Needs you", "No report",
  "Couldn't read wireframe", "Active", "Used", "Passed", "Failed", "Stopped".
  `sentence-case-copy.test.ts` checks the named copy maps.
- **No trailing period on titles, eyebrows, button labels, or list items.**
  Body sentences keep theirs. The one exception is a hero line that stands
  alone, because it is read like a spoken beat ("Stop re-explaining yourself.").
- **Code identifiers in backticks**: `pnpm tauri:dev`, not "the pnpm tauri:dev
  command".

### Structure

- **Show the problem, then the fix.** "You have four CLIs open, each holding a
  different version of the same task. Goodboy holds the context once and
  hands it to whichever one you run next." Not "Goodboy is an AI orchestration
  platform."
- **Concrete over abstract.** "A cheap model to scout, a smart one to plan, a
  mid one to implement" beats "intelligent multi-model routing".
- **Specific friction the reader has felt.** "Re-pasting the goal into a new
  window." "Burning Opus on a one-liner."
- **No feature inventory dumps.** Pick the few features that matter and write
  them as scenarios. Leave the rest in a short list, one line each.
- **Don't echo the label in its own title.** Eyebrow "Workflow Studio", title
  "Build it once, reuse it forever", not "Build the workflow once".
- **Don't repeat a phrase across sections.** "In one place", then "in one
  rail", then "all in one place" reads as a tic. Say it once, then vary it.
- **Don't leak internals.** No internal names ("rail", "slice", "turn blob").
  No mechanism either: which thread, function or table, or why it broke in the
  code. Name what the reader sees on screen and what changed for them.
- **Phrase titles so they still fit as the app grows.** "Turn any issue into a
  session" outlives "Turn a Linear issue into a session". Name the integration
  in the body, not the title.
- **A generated reply's structure is the app's, not the model's.** In the
  resolver, the app writes the verdict and resolution lines, and the agent's
  block fills only the middle. If the agent's block opens with "Fixed in
  `abc1234`.", the reader reads the outcome twice.
- **Thread the headline through the page.** If the hero promises "stop
  re-explaining yourself", bring it back where the page delivers on it.

### Layout

- **Put the reassurance next to the action.** "Goodboy is free and
  source-available" belongs right above the Install button, where the cursor already is.
- **Keep the sharp word.** "You micromanage which model gets which task" lands
  harder than "you babysit". Between two true words, take the one with edge.

### Release notes

The changelog is the one place allowed to sell a little, and it earns that by
being short. The lead line is the pitch. Everything under it is plain fact.

- **The heading names the capability, not a mood.** "Pull requests carry the
  queued check state" not "The pull request tells the truth". Objects do not
  tell, know, feel or remember.
- **Budget the length.** The headline feature gets a lead line plus at most
  three short paragraphs. Every other feature gets one or two. A fix gets one
  line. Cut any paragraph that explains why the old behavior existed.
- **Never explain the mechanism.** A fix says what the reader saw before and
  what they see now, then stops. No thread names, no function, variable, table
  or module names, no "the cause was X", no account of how the bug happened or
  how the fix works inside. The internals belong in the PR description and the
  commit message. Nobody outside the team reads a changelog to learn them. The
  announcement post follows this rule too.
- **Say what ships, and stop there.** Public copy (README, docs, website,
  changelog, posts) describes what Goodboy does. Some things belong in the pull
  request description and the issue tracker, not in the copy: verification
  status, open gaps, trade-offs and work not done yet. No "Follow-up:" lines,
  no "known limits" sections, no "not yet", no caveat paragraphs.

### Grounded

- **Don't oversell.** "Reads and comments on Linear issues" not "Full Linear
  integration". Claim what the app does today, nothing bigger.
- **Invite, don't disclaim.** "Try it on real work, open an issue when
  something feels off" beats "Production-ready since day one" and beats a list
  of what is missing.
- **The license is one line.** Name it, link it, stop. Its terms live in
  `LICENSE.md`.

## Examples

### Headlines

Bad:

> Revolutionize Your AI Workflow with Unified Multi-Provider Orchestration

Good:

> Stop re-explaining yourself.

Bad:

> AI-Powered Workspace for the Modern Developer

Good:

> One inbox for every pull request

### Feature copy

Bad:

> Goodboy leverages advanced AI routing to seamlessly orchestrate your agents
> across providers, unlocking unprecedented productivity gains.

Good:

> Each task goes to the right model, and Goodboy gives you a heads-up before you
> burn Opus on a one-liner. Every session shows its cost in real time.

### Workflow description

Bad:

> Create powerful multi-step automations with our intuitive workflow builder.

Good:

> Refactor incoming? Set up a sequence: a cheap model to scout, a smart one to
> plan, a mid one to implement, another to review, and a final one to open the
> PR. Each step uses the right model, so you're never paying Opus prices to run
> a grep.

### Install instructions

Bad:

> Get started instantly with our blazing-fast installer.

Good:

> No waitlist, no email, no sign-up. Plug in the Claude, Cursor, Codex or
> Antigravity you already pay for and you'll be running on your own machine in a
> minute.

### Fix line

Bad:

> Five of seven launches used to show a window with a title bar and nothing in
> it. Every database call the boot makes ran on the thread that paints, so a
> slow query parked the thread. Those calls now run off it.

Good:

> Goodboy used to open with a blank window five times out of seven. It now
> paints on every launch.

### In-app micro-copy

| Place          | Bad                                       | Good                                              |
| -------------- | ----------------------------------------- | ------------------------------------------------- |
| Empty state    | "No agents available. Configure one now." | "No CLIs connected yet. Pick one to start."       |
| Error          | "An unexpected error occurred."           | "Couldn't reach the Claude CLI. Is it installed?" |
| Confirm dialog | "Are you sure you want to proceed?"       | "Delete this session and all of its turns?"       |
| Loading        | "Please wait…"                            | "Building the context."                           |
| Success        | "Operation successful!"                   | "Session saved."                                  |

## When in doubt

Read it out loud. If it sounds like a press release, rewrite it. If it sounds
like something you'd say to a friend after the third coffee of the day, ship it.
