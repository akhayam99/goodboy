# Overview and activity

Open a session and read everything about the task in one place: its goal, its projects, and the timeline of what happened.

### Session overview

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-light.webp" alt="The overview of the session Stop retried webhooks posting a second credit, with Context, Questions 1 and Artifacts 2, the linked pull request #57, HBL-412 and PAYMENTS-API-3F2, a cost of $3.47, and the projects payments-api (pull request #318 In review) and notify-relay (pull request #57 In review), above an Activity header with Filter, Open run and Start agent">
</picture>

Find the goal, linked issues, projects, cost and the buttons to start an agent or a workflow on one screen. One row under the title holds the facts: **Context**, **Artifacts** (reports, wireframes and plans), linked work, **Link work** and the cost. What waits on you is said once, in **Next**. Projects sits in one band. Each worktree is one row: the branch with a quiet state like "2 to push", the pull request with its state, the changes, and one action with a menu. The part of a split and the distance from main show on hover. Past four open worktrees each project folds to one line, "3 worktrees · 2 in review · +312 -148", that opens on click. A first lap session shows its project folder as a row with **Publish**. The line that explains Projects closes with its x for good. The Activity header has two controls: **Filter**, which also holds **Mark all seen**, and **New**, with **Run workflow**, **Start agent**, **Report** and **Wireframe**. **Run workflow** turns into **Open run** while a run is live, so a second one does not start on top.

### Refresh a session

See pull requests made outside Goodboy without reloading. One an agent opened or you made in a terminal shows up when the turn ends or when you come back to the window. **Refresh**, the first icon at the top right of the session header, next to Archive and Delete, re-reads projects, branches and pull requests right away. While it runs longer than a moment, only the project rows, the pull request chips and the linked work turn to skeleton. **⌘⇧R** and the command palette do the same.

### Activity

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-light.webp" alt="The Activity timeline of the session: a report titled Webhook redelivery no longer double credits, a queued step Cover the console retry states on Haiku 4.5 with a range of 11 to 14 minutes, the question Which failures should count toward a stuck delivery? with an Answer button, a folded row 10 resolves on PR #318 with 3 ready for you, 4 drafting, 2 pushed and 1 failed, Decisions 1 replaced, 1 withdrawn, and a folded row 6 subagents with 5 done and 1 running above the step Implement the stuck-delivery banner on Kimi K3">
</picture>

Read the whole session as one timeline of agents, workflows, questions, fixes, artifacts, pull requests and decisions. Each step shows provider, model, time and cost in the same columns. A question sits on its own row with **Answer** beside it, and the step it blocks is marked **Needs you**. **Filter** trims what the timeline shows. Resolves started together on one pull request fold into a single row, "10 resolves on PR #318", with a mixed node and a summary of their states. It stays closed until you click it or press Enter; the resolves then grow out above it while the row you clicked stays under the pointer, and a second click folds them back. A group of more than eight opens on the eight nearest it, under a **Show 12 more** row. A failed one never opens the group, it shows in red in the summary and in the need-you chip. An agent with three or more subagents folds them the same way into one row, "6 subagents", with a summary like "5 done · 1 running"; a subagent that failed or asks you something colours the ring and counts in the need-you chip without opening the group. A resolver row says the state of its comment, not of the agent: Ready for you, Drafting, Pushed or Draft failed, and a fix waiting on you counts in the need-you chip. The state sits at the same place on every row, right before the model; a finished state like Pushed or Resolved is an icon that says its word on hover. Log rows (Context, an answered question, a plan or report created outside a run, branch and pull request events) are compact, so they never weigh as much as an agent; the Context row says its change in words, "Context · 1 added, 2 replaced". A queued step sits above everything that already happened, so an agent you start after step 1 stays between step 1 and step 2.

### Next

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-light.webp" alt="The Next row of a session: the plan Show the attempts on each delivery, marked Ready to implement, with a Start implementer button and a more menu">
</picture>

Know the one move that unblocks a task, like answering a question, fixing a failing check or opening a pull request. Here the plan **Show the attempts on each delivery** is ready, and **Start implementer** starts it. **Not now** in the row menu puts a suggestion away until the situation changes.

### Time left

See how long a step has left, learned from your own past runs. Queued steps show a range, like the **~11-14m** on **Cover the console retry states** in the timeline above. A slow run says "Longer than usual", and thin history shows a count instead of a guess.

### File versions

Undo an agent's edit in a session without a branch: each file it changed is kept as it was, with **Restore**.
