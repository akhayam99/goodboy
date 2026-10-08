# Overview and activity

Open a session and read everything about the task in one place: its goal, its projects, and the timeline of what happened.

### Session overview

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-light.webp" alt="The overview of the session Stop retried webhooks posting a second credit, with Context, Questions 1 and Artifacts 2, the linked pull request #57, HBL-412 and PAYMENTS-API-3F2, a cost of $3.47, and the projects payments-api (pull request #318 In review) and notify-relay (pull request #57 In review), above an Activity header with Filter, Open run and Start agent">
</picture>

Find the goal, linked issues, projects, cost and the buttons to start an agent or a workflow on one screen.

#### Facts row

One row under the title holds the facts: **Context**, **Artifacts** (reports, wireframes and plans), linked work (a branch glyph marks a task linked to one branch), **Link work** and the cost. What waits on you is said once, in **Next**.

#### Projects

Projects sits in one band, one row per worktree: the branch, the tasks linked to it, a quiet state like "2 to push", the pull request and its state, the changes, and one action with a menu. Hover a row to see the part of a split and the distance from main.

- Past four open worktrees, a project folds to one line, "3 worktrees · 2 in review · +312 -148", that opens on click
- A first lap session shows its project folder as a row with **Publish**
- The line that explains Projects closes for good with its x

#### Start something

The Activity header has two controls: **Filter**, which also holds **Mark all seen**, and **New**, with **Run workflow**, **Start agent**, **Report** and **Wireframe**. **Run workflow** turns into **Open run** while a run is live, so a second one doesn't start on top.

### Refresh a session

See pull requests made outside Goodboy without reloading. One an agent opened or you made in a terminal shows up when the turn ends or when you come back to the window. **Refresh**, the first icon at the top right of the session header, next to Archive and Delete, re-reads projects, branches and pull requests right away. While it runs longer than a moment, only the project rows, the pull request chips and the linked work turn to skeleton. **⌘⇧R** and the command palette do the same.

### Activity

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-light.webp" alt="The Activity timeline of the session: a report titled Webhook redelivery no longer double credits, a queued step Cover the console retry states on Haiku 4.5 with a range of 11 to 14 minutes, the question Which failures should count toward a stuck delivery? with an Answer button, a folded row 10 resolves on PR #318 with 3 ready for you, 4 drafting, 2 pushed and 1 failed, Decisions 1 replaced, 1 withdrawn, and a folded row 6 subagents with 5 done and 1 running above the step Implement the stuck-delivery banner on Kimi K3">
</picture>

Read the session in two views, **Activity | Log**. Activity holds what you launched, the Log holds the facts.

#### One row per launch

An agent, a run and a fix run are one row each, and every row reads the same, left to right:

- The role as a small icon (Scout, Planner, Implementer and the rest), or a run icon, never a word
- The title
- The state or its one action, always right before the time. A finished state like Pushed or Resolved is an icon that says its word on hover
- The provider and the model that ran. A step that moved to another model shows each in order (**Kimi K3 → Sonnet 5.5**), and a run shows **Sonnet 5.5 + 1** or **4 models**, never a clipped name
- The duration, with the cost under it

Rest the pointer on a role icon or a model, or press **I** on a focused row, to open its card: the model and effort, start and finish, tokens, cost and why a model took over. Hover a clock to see when the row started and finished.

When the timeline is narrow, like with the Context drawer open, the model shrinks to its icon, then the cost leaves, then the time, so the title stays readable. A row you can click takes a soft wash under the pointer and a ring on keyboard focus; a row that waits on you or has news keeps its tint.

#### Needs you

When something waits on you, a **Needs you** block sits on top with one row per owner, each with **Open**:

- "#318 · 1 question · 5 to review"
- "Retry policy · 1 question"
- "Rebase of feat/export stopped ×2"

It disappears when nothing waits and never offers Push. A subagent that asks you or failed counts here too.

#### Order and lanes

The feed reads up like a git graph: newest first at every level, children above their parent, the steps of a run above the run row, and the clock never rises going down.

- Each run has a lane in its own colour, dashed up to **Now** while the run is live. Children hang one indent in, on a 2px line in that colour
- A click on a lane or a run row opens the run page, which lists every step in the order they ran
- A queued step sits on the dashed stretch under **Now**, with no clock

#### Folding

A finished run or chain of agents folds into its own row, with a summary above it: "8 steps · 1 question answered · Context · 2 added, 2 replaced". The Context part shows only when its steps changed the session context. Open it with a click or the Right arrow.

- A run that still asks you something, failed or is running stays open. One that finishes while you look stays open until you fold it
- A finished step with subagents shows one muted row, "6 subagents". Open it to see them above the step, numbered 8.6 down to 8.1, each with its time and cost; the step's total counts them once. Subagents still working, queued or failed always show
- A finished agent that made a plan, a report, a wireframe or a learning shows "3 outputs" above it

#### Fix runs

A fix run is one row, "Fix run · #318 · 9 comments", with no row per agent. It shows its tally ("5 ready · 1 needs you · 2 working · 1 couldn't fix") in the five comment words, Working, Needs you, Ready, Couldn't fix and Done, then the model, the real time span and the cost. A click opens its transcript in a drawer on the Comments tab of the Branch. A comment that needs you or couldn't be fixed also shows in Needs you.

#### Log

The Log is flat, newest first, one compact muted row per fact, with a search box on top and no categories. It holds:

- Context changes ("Context · 1 added, 2 replaced")
- Plans, reports, wireframes and learnings made without a launch
- Branch, worktree and pull request events
- Links, with **Re-link** on an unlink
- Questions answered without a launch
- Session archive and restore

A history row that still has a recovery stays in Activity and opens the Commits tab, where Undo rewrite, Retry and Restore previous history live. Stops of the same rebase on one day merge into one row, "Rebase of feat/export stopped ×2", which acts on the newest stop.

### Next

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-light.webp" alt="The Next row of a session: the plan Show the attempts on each delivery, marked Ready to implement, with a Start implementer button and a more menu">
</picture>

Know the one move that unblocks a task, like answering a question, fixing a failing check or opening a pull request. Here the plan **Show the attempts on each delivery** is ready, and **Start implementer** starts it.

- **Not now** in the row menu puts a suggestion away until the situation changes
- A step that starts an implementer, reviewer, resolver, PR reviewer or debugger shows **Runs on** with its model and effort, and **Change** picks another for that start

### Time left

See how long a step has left, learned from your own past runs. Queued steps show a range, like the **~11-14m** on **Cover the console retry states** in the timeline above. A slow run says "Longer than usual", and thin history shows a count instead of a guess.

### File versions

Undo an agent's edit in a session without a branch: each file it changed is kept as it was, with **Restore**.
