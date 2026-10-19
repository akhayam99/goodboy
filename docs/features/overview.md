# Overview and activity

Open a session to see what it is for, what needs you and what happened so far.

### Session overview

The Overview is titled with the session's name, its linked issue key in gray before it, and a single click renames it in place across the whole title row (Enter saves, Escape cancels). A small ring at the end of the field fills toward the 120 character limit and turns amber near it. It reads top to bottom: the goal, then anything a branch needs you to decide (a closed worktree with **Reopen**, a failed action with **Retry**, a stopped rebase, a branch that moved), then **Needs you**, **Next** and **Activity**. **New** in the header starts an agent, a workflow or a write-up. The projects, branches and linked work of the session sit in the sidebar: click a branch to open its pull request, comments, files, commits and checks.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-light.webp" alt="The overview of the session Stop retried webhooks posting a second credit: the rail with Overview, Runs, Orchestrated, Agents with a Deprecated marker, Auto agents with an Experimental marker, Artifacts and Questions, and the projects payments-api (pull request #318 and #311) and notify-relay (pull request #57), the goal, a Needs you block with a question, and the Activity and Log tabs with the first steps">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Refresh a session

Pull requests opened outside Goodboy, by an agent or from a terminal, show up when a turn ends or when you come back to the window. **Refresh** in the session's `...` menu, or **⌘⇧R**, re-reads projects, branches and pull requests right away.

### Activity

Follow what happened in a session in two views. **Activity** has one row per agent, workflow run or fix run, with its state, model, time and cost; step numbers line up in one column that no lane crosses. Every row carries the glyph its concept has in the sidebar and the **New** menu: a workflow run the Workflows glyph, an orchestrated run the orchestrator glyph, an agent its role. The **Needs you** block above Next lists what waits on you, and each row opens the exact ask. **Log** lists the plain facts, such as context changes, branch events and links, newest first with a search box.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-light.webp" width="821" alt="The Activity timeline of a session: a Needs you block with #318 and Which failures should count toward a stuck delivery, a Next row with Fix and Not now, the Activity and Log tabs with Mark all seen, and below Now the steps, each row with a role icon, its title, its model and its time, a Fix run on #318 with 4 need you and 4 working, and Add the stuck-delivery banner on Kimi K3">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Next

Know the moves that unblock the task, such as answering a question, fixing a failing check or opening a pull request. **Next** offers up to three, each as one short button such as **Start**, **Analyze** or **Push**, the first one filled, and **Not now** puts a suggestion away until the situation changes. Next only gives the hint that starts something: once **Analyze** starts the Debugger on a failing check, its next moves (open the analysis, **Start fix**, **Push**) sit on that run's Activity row, and a workflow's ready step keeps its **Start** on the run row. Next does not repeat them. **Open a pull request** names the branch it opens in its title, as in **Open a pull request for hl/refund-retry**, with the project and the commits ahead under it. With several branches still without a pull request, Next shows one card for the branch furthest ahead, **⋯** lists every one of them, and **Not now** moves the card to the next branch. Once a pull request merges, Next offers **Remove the payments-api worktree** with the reason and its size (`#418 merged · 412 MB`), or one row for several merged worktrees. When the button starts an agent, the icon on the left is that agent's role in its color, and the button carries the same icon. Other ways to do it, such as starting a tester instead, sit in the **⋯** menu, where pointing at one shows its role on the icon. **Not now** says Dismissed with **Undo**, and ⌘Z brings the last dismissed suggestion back, several times in reverse order.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-light.webp" width="821" alt="The Next block of a session: Split the reconciliation rewrite into six parts, Ready to implement, with a Start button, and Remove the ledger-core worktree, #418 merged, 412 MB, with a Remove button, each with Not now">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Time left

See how long a step has left, estimated from your own past runs. Queued steps show a range, and a run slower than usual turns its time warm.

### Changes

See and undo what agents changed in a session without a branch. In a plain folder agents edit in place, and every writing turn saves what it may change first, shell commands such as `rm` and `mv` and new files included. **Changes** in the session rail lists each turn, newest first, with the files it added, changed or removed and their line counts; pick a file to see its text before and after, with the changed words marked. **Restore to before turn 3** puts one file back, **Restore turn 3** puts back the whole turn, and **Remove this new file** takes out a file the agent created. Each restore first saves the text you have now, so **Undo restore** puts it back, and a restore over text that changed after the turn asks in place before it writes. The rail's **Folder** group names the folder and what agents do there, the Overview opens on a card that says where agents write and what is saved, and each writing turn in the chat ends in a card with **Review changes** and **Restore turn**. Versions are kept until 30 days after the session ends, within a cap per folder of 1 GB or the folder's own size, whichever is larger; the page shows how much they use, what was left out (files over 15 MB, links that leave the folder, dependencies and build output), and Storage shows their size under **Saved versions**. A session that still works in an older session folder keeps its list of file versions under the same page.
