# Tone of voice

> **Read this when** writing any user-facing string: README, website,
> release notes, in-app copy, error messages. **Not for** repository language
> outside product copy (see `CONVENTIONS.md`) or visual layout and typography
> (see `DESIGN.md`).

How Goodboy talks. README, website, release notes, in-app copy, error
messages: if a human reads the string, it lives by these rules.

## The shape

Write like someone who's been in the trenches with the reader, not a brand
addressing a market. Two voices:

- **Product voice** ("Goodboy does X"): direct, second person, concrete.
  README, feature sections, in-app copy.
- **Author voice** ("I built this because…"): first person, conversational,
  reserved for the founder note and release blog posts. Never bleeds into
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

- **No single-provider assumption in chrome.** Launch screens, empty states and
  headers never address the user as a Claude session or imply Claude is the
  runtime. Name a provider only where the copy is genuinely about it (a Claude
  error, a Codex setup step).
- **No hardcoded user nickname.** A greeting that needs a name reads it from the
  user's profile, never a constant. In doubt, drop the greeting.
- **Product copy is in English.** Every label, placeholder, empty state, tooltip
  and button. A new string in another language is a bug: translate it.
- **Don't leak a contributor's assistant config.** Nicknames, casing, house
  style and conversational language from a local setup are a bug in a mock or a
  PR: strip them.

### Punctuation

- **No em dashes.** Period, comma, colon or parentheses instead.
- **One sentence per idea.** Don't chain three clauses with semicolons.
- **Sentence case** for headings. Not Title Case. The tiny-eyebrow casing
  exception is owned by [DESIGN.md](../DESIGN.md) in Voice & copy.
- **No trailing period on titles, eyebrows, button labels, or list items.**
  Body sentences keep theirs. A standalone hero line is the one exception, for
  the spoken beat ("Stop re-explaining yourself.").
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
- **No feature inventory dumps.** Pick the few that matter, write them as
  scenarios, leave the rest in a short list with one line each.
- **Don't echo the label in its own title.** Eyebrow "Workflow Studio", title
  "Build it once, reuse it forever", not "Build the workflow once".
- **Don't repeat a phrase across sections.** "In one place", then "in one
  rail", then "all in one place" reads as a tic. Say it once, then vary it.
- **Don't leak internals.** Not the names ("rail", "slice", "turn blob"), not
  the mechanism (which thread, function or table, why it broke in the code).
  Name what the reader sees on screen and what changed for them.
- **Phrase titles to scale.** "Turn any issue into a session" outlives "Turn a
  Linear issue into a session". Pin the integration in the body, not the title.
- **A generated reply's structure is the app's, not the model's.** In the
  resolver the verdict and resolution lines are generated and the agent's block
  supplies only the middle. A resolver opening with "Fixed in `abc1234`." makes
  the reader read the outcome twice.
- **Thread the headline through the page.** If the hero promises "stop
  re-explaining yourself", let it resurface where it pays off.

### Layout

- **Put the reassurance next to the action.** "Goodboy is free and open
  source" belongs right above the Install button, where the cursor already is.
- **Keep the sharp word.** "You micromanage which model gets which task" lands
  harder than "you babysit". Between two true words, take the one with edge.

### Release notes

The changelog is the one place that gets to sell a little, and earns that by
being short. The lead line is the pitch; everything under it is plain fact.

- **The heading names the capability, not a mood.** "Pull requests carry the
  queued check state" not "The pull request tells the truth". Objects do not
  tell, know, feel or remember.
- **Budget the length.** The headline feature gets a lead line plus at most
  three short paragraphs. Every other feature one or two. A fix one line. Cut
  any paragraph explaining why the old behavior existed.
- **Never explain the mechanism.** A fix says what the reader saw before and
  what they see now, then stops. No thread names, no function, variable, table
  or module names, no "the cause was X", no account of how the bug happened or
  how the fix works inside. The internals are the PR description and the commit
  message, and nobody outside the team reads a changelog to learn them. The
  announcement post lives by this rule too.
- **State a limit inside the sentence that promises the thing**, not in a
  paragraph of its own. "Public channels the bot has joined" beats four
  sentences of scope caveats.
- **Work not yet exercised against a live service is a follow-up, never a
  confession.** Never write "not verified", "this has not run against a live
  X", or "proves nothing". Write what the work stands on and what the app does
  when reality disagrees:

  > Follow-up: the mutation and its input come from Linear's published
  > schema, though no call has gone out to a live Linear workspace yet. If a
  > shape differs, Linear's own error comes back in the composer with the
  > draft still in it.

  One line at the end of the feature it belongs to, and one line can cover
  several features sharing the same follow-up.

### Honesty

- **Don't oversell the roadmap.** "A proper Linear Studio is on the way" not
  "Full Linear integration".
- **Name the limits.** "Needs a Rust toolchain. Prebuilt binaries for Linux
  and Windows coming." Not silence.
- **Admit when something is rough.** "Try it, break it, send feedback" >
  "Production-ready since day one".

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

Read it out loud. Sounds like a press release: rewrite. Sounds like something
you'd say to a friend after the third coffee of the day: ship it.
