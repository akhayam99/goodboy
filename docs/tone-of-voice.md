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

### Punctuation

- **No em-dashes** (`—`). Use a period, comma, colon, or parens instead.
  Em-dashes read as ChatGPT.
- **One sentence per idea.** Don't chain three clauses with semicolons.
- **Sentence case** for headings. Not Title Case. Not ALL CAPS.
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

> Every pull request, in one inbox.

### Feature copy

Bad:

> Goodboy leverages advanced AI routing to seamlessly orchestrate your agents
> across providers, unlocking unprecedented productivity gains.

Good:

> Each task goes to the model that fits it, and Goodboy nudges you before you
> burn Opus on a one-liner. Every session shows what it is costing you as it
> runs.

### Workflow description

Bad:

> Create powerful multi-step automations with our intuitive workflow builder.

Good:

> Refactor incoming? Line up a sequence: a cheap model to scout the area, a
> smart one to plan it, a mid one to implement, another to review, a cheap one
> to open the PR. Each step picks its own provider and model, so you're never
> paying Opus prices to run a grep.

### Install instructions

Bad:

> Get started instantly with our blazing-fast installer.

Good:

> No waitlist, no email, no sign-up. Plug in the Claude, Cursor, Codex or
> Gemini you already pay for and you're running on your own machine in a
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
