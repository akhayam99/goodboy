# Goodboy: Vision

> **Read this when** you want to know what Goodboy is and why it exists before
> contributing. **Not for** everyday build work: the three questions in
> `DESIGN.md` cover most decisions.

## The problem

The IDE was designed around the file. Everything it shows you, the tree, the
tabs, the editor, the terminal, assumes the unit of work is a buffer of text.
That was true when you wrote the code by hand.

It is not true anymore. The unit of work is now the task: fix this Sentry
issue, ship this Linear ticket, address this review comment, land this PR.
Code is what a task produces, not what a task is. Yet every tool still makes
you start from the file and reconstruct the task in your head, gathering the
issue, the thread, the diff, the review, the deploy, one browser tab at a
time.

AI-assisted development made this worse, not better. Every session starts from
zero, context bloats fast, you pay for the same information twice, and
switching between tasks means losing everything or cramming unrelated work
into one giant thread. There is no layer between you and the agents. No
orchestration. No structured way to share learnings. No cost awareness. No
plans beyond chat transcripts.

## The mission

**Work better. Spend less. Ship faster. Stay in control.**

Goodboy is the hub. Not another window next to Slack, Linear and GitHub: the
place that makes opening them unnecessary. You connect the apps you already
use, grant the authorizations you choose, and then read, act and decide from
one surface: write the message, consult the task, review the pull request,
without leaving. The measure of every release is blunt: **which reason to
open another tool did this remove?**

Goodboy is a local-first workspace where the task is the primary object, the
integrations that define the task are second, the code is third, and the chat
is the last mile. It does not replace your editor or your terminal. It
commands them.

## Who it is for

Anyone who runs work through shared context, with a gradient of how much code
they want to see:

- **The developer** wants the task, the diff, the checks and the merge without
  leaving the workspace.
- **The PM, PO, or non-coder** wants the issue, the plan, the status, the
  conversation and the outcome, and should never need a raw diff to understand
  what happened. This is a first-class read of the same task, not a degraded
  mode.
- **The data engineer, the marketer, the student** want the same thing with
  their own objects: a goal, connected sources, agents that do the legwork,
  and a record of what was decided.

The direction is to make every user a **builder**: someone who states a goal,
routes it, and reviews outcomes. Goodboy's job is to simplify the actions and
answers that resolve a task so far that chat and code become the last layer
you reach for, not the first. When you do drop into them, they are one click
away and fully powered.

## What Goodboy is NOT

- Not a text editor. You already have one, and Goodboy drives it.
- Not another chat UI. The world has enough.
- Not a wrapper around one AI provider. It orchestrates all of them.
- Not a cloud service. It runs on your machine, your data stays local.
- Not a data collector. Your data flows directly between you and your
  providers. Goodboy is the local layer in between.

## Zero data ownership

Goodboy is a pure orchestration layer. We do not run servers. We do not have
accounts. We do not store, log, or transmit your data anywhere except to the
AI providers you choose.

- No backend. Ever.
- No telemetry. Not now, not later, not opt-in.
- API keys stay on your machine, in your OS credential store.
- Conversations, prompts, and responses flow directly between you and the
  provider.
- Local persistence is SQLite (`~/.goodboy/data.db`): workspaces, sessions,
  agents, messages, context slots, plans, local usage records, skills,
  settings. All yours, all local.

If Goodboy disappeared tomorrow, your data would be untouched, because it was
never ours.

## Principles

1. **The task is the unit of work**: files, threads, and diffs are what a task
   touches, not what it is.
2. **Remove the reason to open the other tool**: every release is measured by
   the tab it made unnecessary.
3. **Context is expensive**: never send more than needed.
4. **Sessions are goals, not threads**: structure work by intent, not by time.
5. **Integrations are the product, not a panel**: work starts and ends outside
   the repo.
6. **Chat and code are the last layer**: simplify the action first; keep the
   deep layer one click away and fully powered.
7. **Automate the repeatable**: if you did it twice, make it a skill.
8. **Provider agnostic**: no lock-in, ever.
9. **Local first, local only**: your machine, your keys, your data, full stop.
10. **Plans over chat**: structure intent as artifacts, not buried in
    transcripts.
