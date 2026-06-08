# Tone of voice

This is how Goodboy talks to people. README, website, release notes, in-app
copy, error messages. If a string is going to be read by a human, it lives by
these rules.

## The shape

Write like a person who's been in the trenches with the reader, not a brand
addressing a market. The user has four CLIs open and an unfinished refactor.
They don't want to be sold to. They want to be understood, then helped.

Two voices in the codebase:

- **Product voice** ("Goodboy does X"): direct, second person, concrete. README,
  feature sections, in-app copy.
- **Author voice** ("I built this because…"): first person, conversational,
  reserved for the founder note and release blog posts. Never bleeds into
  product copy.

## Rules

### Words to avoid

- **"AI"**. Say `agent`, `model`, `Claude`, `Codex`, `Cursor`, `Gemini`, or
  the specific behavior. "AI" is a marketing word; we don't need it.
- **"powered by"**, **"intelligent"**, **"smart"**, **"seamless"**,
  **"revolutionary"**, **"blazing fast"**, **"next-gen"**. Fluff. Cut.
- **"simply"**, **"just"**, **"obviously"**, **"basically"**. Minimizers. If
  the thing is simple, the reader can decide that. If it isn't, you're lying.
- **"unlock"**, **"empower"**, **"leverage"**, **"streamline"**. Sales-deck
  verbs. Use the actual verb.
- **"enterprise-grade"**, **"world-class"**, **"best-in-class"**. Empty
  superlatives. Be specific or stay quiet.

### Neutrality

Goodboy is its own tool and routes across many providers. Copy must not bind
the product to one provider or to the person who happened to write it.

- **No single-provider assumption in chrome.** Launch screens, empty states,
  headers, and other product surfaces don't address the user as a Claude
  session or imply Claude is the runtime. Name a specific provider only where
  the copy is genuinely about that provider (a Claude error, a Codex setup
  step). The orchestrator itself stays neutral.
- **No hardcoded user nickname.** Don't bake in a name or salutation. If a
  greeting needs a name, read it from the user's own profile, never a constant.
  In doubt, drop the greeting: the mascot plus the action is enough.
- **Product copy is in English.** Goodboy ships in English: every label,
  placeholder, empty state, tooltip, and button. The language a contributor
  happens to chat in (with a teammate, in a PR, with a coding agent) never
  becomes the product's language. If a new string is in any other language,
  it's a bug. Translate it.
- **Don't leak a contributor's assistant config.** How a coding agent is told
  to address its operator (nicknames, casing, house style, conversational
  language) belongs to that contributor's local setup, never to Goodboy's
  product copy or code. If you see such a string in a mock or a PR, it's a
  bug. Strip it.

### Punctuation

- **No em-dashes** (`—`). Use a period, comma, colon, or parens instead.
  Em-dashes read as ChatGPT.
- **One sentence per idea.** Don't chain three clauses with semicolons.
- **Sentence case** for headings. Not Title Case. Not ALL CAPS.
- **No trailing period on titles, eyebrows, button labels, or list items.**
  Body sentences keep theirs. A standalone hero line is the one exception: it
  can keep its period for the spoken beat ("Stop re-explaining yourself.").
- **Code identifiers in backticks**: `pnpm tauri:dev`, not "the pnpm tauri:dev
  command".

### Structure

- **Show the problem, then the fix.** "You have four CLIs open, each holding a
  different version of the same task. Goodboy holds the context once and hands
  it to whichever one you run next." Not "Goodboy is an AI orchestration
  platform."
- **Concrete over abstract.** "A cheap model to scout, a smart one to plan,
  a mid one to implement" beats "intelligent multi-model routing".
- **Specific friction the reader has felt.** "Re-pasting the goal into a new
  window." "Burning Opus on a one-liner." If the reader nods, you've earned
  the next paragraph.
- **No feature inventory dumps.** Pick the few that matter, write them as
  scenarios, leave the rest in a short list with one line each.
- **Don't echo the label in its own title.** The eyebrow already said "Workflow
  Studio", so the title is "Build it once, reuse it forever", not "Build the
  workflow once". The reader knows the topic. Spend the title on the payoff.
- **Don't repeat a phrase across sections.** "In one place", then "in one rail",
  then "all in one place" three sections running reads as a tic. Say the spatial
  idea once, then vary it. The same goes for the headline's verbs and nouns.
- **Don't leak internal names.** "Rail", "slice", "turn blob": clear in the
  codebase, opaque on a landing page. Name what the reader sees on screen, not
  what we call it in the source.
- **Phrase titles to scale.** "Turn any issue into a session" outlives "Turn a
  Linear issue into a session": when the next tracker lands, the headline still
  holds. Pin the specific integration in the body, not the title.
- **Thread the headline through the page.** If the hero promises "stop
  re-explaining yourself", let that line resurface where it pays off, the
  shared-context section, the founder note. A callback rewards the reader who
  got that far.

### Layout

- **Put the reassurance next to the action.** "Goodboy is free and open source"
  belongs right above the Install button, not five lines up. The reader commits
  at the click, so the proof has to sit where the cursor already is, not in a
  paragraph they scrolled past.
- **Keep the sharp word.** "You micromanage which model gets which task" lands
  harder than "you babysit". Between two true words, take the one with the most
  edge, never the one that softens it.

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
> Gemini you already pay for and you'll be running on your own machine in a
> minute.

### In-app micro-copy

| Place          | Bad                                       | Good                                              |
| -------------- | ----------------------------------------- | ------------------------------------------------- |
| Empty state    | "No agents available. Configure one now." | "No CLIs connected yet. Pick one to start."       |
| Error          | "An unexpected error occurred."           | "Couldn't reach the Claude CLI. Is it installed?" |
| Confirm dialog | "Are you sure you want to proceed?"       | "Delete this session and all of its turns?"       |
| Loading        | "Please wait…"                            | "Building the context."                           |
| Success        | "Operation successful!"                   | "Session saved."                                  |

## When in doubt

Read it out loud. If it sounds like a press release, rewrite. If it sounds like
something you'd say to a friend after the third coffee of the day, ship it.
