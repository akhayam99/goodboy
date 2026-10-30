# Overview and activity

Open a session to see what it is for, what needs you and what happened so far.

### Session overview

Read a session as one page: the goal, what needs you, what runs and where each branch stands.

The Overview is titled with the session's name, with its linked issue key in gray before it. A single click renames it in place across the whole title row. Enter saves and Escape cancels. A small ring at the end of the field fills toward the 120 character limit and turns amber near it.

It reads top to bottom:

- The goal.
- Anything a branch needs you to decide: a closed worktree with **Reopen**, a failed action with **Retry**, a stopped rebase, a branch that moved.
- One card per job, in the order of who acts: **Needs you** (you must), **Running** (agents are), **Next** (you may), **Branches** (where each branch stands) and **Done** (finished).

An empty card is not drawn. An archived session keeps only **Done**.

**New** in the header starts an agent, a workflow or a write-up. The projects, branches and linked work of the session sit in the sidebar. Click a branch to open its pull request, comments, files, commits and checks.

**Reading the task without a diff.** A product manager understands where a task stands from the page alone, never from a raw diff or a file list. Six things hold, in this order:

1. **The goal.** The page opens on what the task is for, in the words you gave it.
2. **The state.** One sentence from the running summary says where the work stands, with when it was written. It turns gray when it is older than a day, and when a pull request moved after it was written the branches below win and the line says so.
3. **What waits for you.** **Needs you** comes first and each row says why in words.
4. **What is at work.** **Running** names each agent or run with the step it is on, such as "Step 3 of 6", and the time it has taken or the time left.
5. **Where each branch stands.** **Branches** shows the six stages of every branch and the one step it stands at.
6. **What finished.** **Done** counts the runs and agents that finished, lists the last three with their outcome and an unread dot, and opens the full log.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-light.webp" alt="The overview of Stop retried webhooks posting a second credit, with the goal, a Needs you block and the projects payments-api and notify-relay">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Refresh a session

Pull requests opened outside Goodboy, by an agent or from a terminal, show up when a turn ends or when you come back to the window. **Refresh** in the session's `...` menu, or **⌘⇧R**, re-reads projects, branches and pull requests right away.

### Full log

Follow what happened in a session in one list. **Full log** on the **Done** card opens it in a drawer beside the page. So do **Open the full log** in the session's **⋯** menu and ⌘K.

- One row per agent, workflow run or fix run shows its state, model, time and cost.
- Plain facts get a row too, such as context changes, branch events and links.
- Rows go newest first, with a search box.
- Every row carries the glyph its concept has in the sidebar and the **New** menu. A workflow run has the Workflows glyph, an orchestrated run the orchestrator glyph, and an agent its role.
- **Mark all seen** clears the unread marks.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-light.webp" width="821" alt="The Activity timeline of a session: a Needs you block with #318 and Which failures should count toward a stuck delivery, a Next row with Fix and Not now, and below Now the steps, each row with a role icon, its title, its model and its time, a Fix run on #318 with 4 need you and 4 working, and Add the stuck-delivery banner on Kimi K3">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Cards

See what needs you, what runs, what is next, where each branch stands and what finished.

**Needs you**

- It holds the **Decide** and **Fix** rows of Next: a plan that waits on your OK, a question, a stuck agent, a failing check, review conversations.
- Its header counts them. Every group is open.

**Running**

- It groups the agents and runs by what you do next. **Waiting for you** paused for an answer (the **Needs you** card above holds the asks), **Running** works or decides, **Stopped** failed or was stopped by you. A group with nothing in it is not drawn, and a waiting or stopped item never sits under **Running**. Inside a group the items keep the order they started in.
- Every row is one line: one round icon (the role colors the icon, nothing else), the kind (**Workflow**, the role of an agent, **Auto agent**), then the title.
- One **Where** column names the branch it writes to. It is blank when the run writes nowhere. It shows the project only across two projects.
- The row then shows its status as a short muted word next to one colored dot, or the run's own next move. Its time sits in a right column that lines up for child agents too. The cause, such as "Origin moved" or "Waits for your go on step 2", sits on a second muted line only for a row that waits or stopped.
- A run shows its steps as a bar. Done steps are grey, the running step is the accent color and pulses, a step that waits for your go is amber and a failed step is red. The role never colors the bar. A run of two steps or fewer shows a count instead, such as **1/2**.
- Resting on the bar shows the step, the workflow, the role, the model, the time in and what comes next. A click opens the step.
- The run's next move is the run page's own button (**Start step 2**, **Review plan**, **Answer**). **Answer** opens the question in the side drawer and the page stays. That move is not repeated in **Needs you**.
- The agents a run, an agent or Auto started hang under it on one thin line.
- When an agent Auto started is stuck, the Auto row says **Stuck**. One line under it offers **Answer** and **Stop**. **Retry** is on the **Needs you** card, once.
- **Retry** on the Fix row retries the stuck agent. When it fails, the card keeps the error. **Answer** opens the Auto chat.

**Next**

- It holds **Update** and **Ship**. Its groups fold until nothing needs you.
- Only one button is filled across both cards. It sits on the first row of **Needs you** or, with nothing there, the first row of **Next**.

**Done**

- It says in one line which branches merged or closed and how many runs and agents finished.
- It then lists the last three finished items, newest first. Each shows who did it, the outcome in one sentence, how long ago, and a dot when the reply was not read yet.
- A run reads "Orchestrated · 7 agents · 3 of 5 steps" or "Auto · 6 agents · 1 needs you". It gives the kind, how many agents it started, how far it got and, only when something waits for you, what needs you. It never lists step numbers.
- An agent shows its role with its icon and the provider mark, never the bare word "Agent".
- The title is the first sentence of what the agent said, cut to one short line. A leading tag like "cluster 1/2:" and commit hashes go. A list like "lint/knip/vitest" reads "lint, knip and vitest". A long path keeps its file name.
- A click opens the agent or run.
- The header counts the unread ones, as in "Done 5, 1 unread".
- An archived session keeps this card with its list.

**New since you last looked**

- It sits above everything else while something is unread, and lists each unread item, newest first, so you do not need the full log to see what is new. Each row reads like a row of **Done**.
- A click opens the item and marks it seen. Showing it does not.
- **Mark all seen** clears them all.
- The blue dot on a session in the sidebar says what is new when you hover it, as in "1 new: Step 1 result of the Harborline ledger". It counts the same items as this card.

**Branches**

**Branches** lists the branches still in play and tells the story of each one, one row per branch.

- A row names the branch and shows one connected track of six stages: Commit, Push, Pull request, Checks, Review and Merge.
- The track is filled up to where the branch stands. The state color shows only on that stage.
- Next to it is the step the branch stands at, such as **Checks failing** in red, **No pull request** in grey, **Approved** in green or **Merged** in violet. The state has the same color everywhere in the app.
- One short fact follows, such as "2 threads to answer" or "24 commits to push".
- The project shows only when the branches come from two or more projects.
- A step that does not apply is a short dash instead of a circle. Examples are a repo with no checks and a pull request that needs no review.
- A queued pull request shows **In merge queue** on the last step. Every stage names itself on hover.
- Rows go by whose move it is. Blocked comes first: checks failing, conflicts, changes requested, remote branch gone.
- Then comes ready to merge, then your move (not pushed, no pull request, draft, nothing committed), then a branch an agent works on. Waiting on others comes last: in review, checks running, in merge queue.
- Two branches of one rank keep the order they were first seen. A Next card never moves a row.
- A merged or closed branch leaves the list for the **Done** line.
- With many branches the list shows eight, and one line counts the rest.
- The rows hold no button. The verbs stay in **Next**. A right click on a row opens the same branch menu as the rail.

See [mounts.md](../mounts.md) for how each word is read.

**A series of branches**

- A branch that an agent declared part of a series shows **Part 2 of 3** before its name.
- One strip above the rows reads **Series ledger-rounding, part 2 of 3**, with a dot per part. A part is merged, in progress, or planned with no branch yet. The strip names a planned part (**Part 3 of 3 is planned, no branch yet**).
- The agent declares a series. Goodboy never guesses it from branch names.
- When two or more parts hold an open request, **Ship** in Next offers **Merge ledger-rounding in order**.
- It asks for confirmation. It merges the bottom part first and re-reads each part right before it merges.
- It stops at the first part that cannot merge. The reason sits under the row: checks failing, conflicts, draft, changes requested, closed or a host error. Run it again after fixing it and it carries on from that part.
- It shows only on hosts that can merge with a chosen method (GitHub, GitLab and Bitbucket today). It never merges a part it did not re-read.

### Next

Know the moves that unblock the task, such as answering a question, fixing a failing check or opening a pull request.

- **Next** offers up to three moves. Each is one short button such as **Start**, **Analyze** or **Push**. The first one is filled.
- **Not now** puts a suggestion away until the situation changes. A failing check or an approval you put away stops counting as a reason for the session to sit in **Needs you** until then.
- A question or an approval of your own is never put away this way.
- **Not now** says Dismissed with **Undo**. ⌘Z brings the last dismissed suggestion back, several times in reverse order.
- Next only gives the hint that starts something. **Analyze** starts the Debugger on a failing check. Its next moves (open the analysis, **Start fix**, **Push**) then sit on that run's Activity row.
- A workflow's ready step keeps its **Start** on the run row. Next does not repeat these moves.
- **Open a pull request** names the branch it opens in its title, as in **Open a pull request for hl/refund-retry**. The project and the commits ahead sit under it.
- With several branches still without a pull request, Next shows one card for the branch furthest ahead. **⋯** lists every one of them. **Not now** moves the card to the next branch.
- Once a pull request merges, Next offers **Remove the payments-api worktree** with the reason and its size (`#418 merged · 412 MB`). Several merged worktrees get one row.
- When the session's last branch is merged or closed and a linked Linear or Jira item is not done, Next offers **Move HBL-412 to Done**. It shows the state the item is in now, and the toast has **Undo**.
- An item already done in the tool, a Sentry item or a _Part of_ link gets no row.
- When the button starts an agent, the icon on the left is that agent's role in its color, and the button carries the same icon.
- Other ways to do it, such as starting a tester instead, sit in the **⋯** menu. Pointing at one shows its role on the icon.

**Groups**

**Needs you** and **Next** group their rows by what you do, always in this order.

| Group      | Holds                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| **Decide** | a plan waits on your OK, a question                                                                              |
| **Fix**    | a stuck agent, a failing check, review conversations                                                             |
| **Update** | branches behind or diverged                                                                                      |
| **Ship**   | push, open a pull request, mark ready, merge, move the tracker item, clean up, and last **Archive this session** |

- An empty group is not drawn. Each card counts its own rows in its header.
- Each group folds behind its name with its row count. While folded, it shows the branches or plans it holds.
- The first group with rows opens. What you open or fold stays as you left it for that session.
- Inside a group the row that unblocks most comes first. A plan that covers 4 branches comes before a single retry, and a rebase of 8 branches before one push.
- Rows that unblock as much keep the place they had when they first showed in this window. A refresh never moves them and a new one lands after them.
- **Archive this session** shows with the reason "All branches merged" (or "closed", or "merged or closed"). It needs every branch merged or closed and nothing running, waiting or asking.
- One click archives the session, and the toast offers **Undo**.

**When an item leaves Next**

An item is in **Next** only while you are the next one to act.

- An agent Auto started that you stopped or declined leaves Next. It shows in the full log as "You stopped the reviewer". One a later agent replaced on the same branch leaves too.
- A stopped rebase of a branch that is still behind is not a card of its own. The "branches behind" card says how many rebases stopped and lists each one in its **⋯** menu.

**One row per kind of work**

Each branch, pull request or Auto plan shows once per kind of work.

- Say an agent Auto started is stuck on a branch that also has a failing check, or two of its agents are stuck there. Next shows one row led by the worst blocker: blocked, then timed out, then never started, then a check.
- That row says "and 1 more" in its sentence and puts the others in its **⋯** menu.
- A stuck agent reads by its role and state, as in "The tester timed out. It ran out of time." It never quotes the request Auto sent it.
- A row's title is its subject. A plan that waits on your OK is titled by the plan's name. Its sentence reads "Plan v3 waits on your OK. The run covers 4 branches." These are the branches its agents work on.
- A **Fix** row on a known branch is titled by the branch and its open pull request, as in "hl/feat-center-home-page · #9995". One sentence sits under it, such as "4 review conversations wait for a fix."
- Rows in **Update** and **Ship** keep their verb titles, except a stopped rebase.

**A stopped rebase**

- Its row is titled by its branch. It says in one sentence what stopped ("2 files conflict with main: MembersPage.tsx and 1 more. Your branch is as it was.").
- It leads with the verb that fixes it: **Resolve with Auto**, **Bring them in**, **Retry rebase** or **Fix with agent**.
- **Resolve myself**, **Keep branch as it was**, **Undo rebase** and **Open branch** sit in its **⋯** menu as they apply.
- A click on its title opens the branch with the rebase panel.
- A diverged card of the same branch folds into that row, and its verb goes into the **⋯** menu. It never shows as "and 1 more".
- Stopped rebases of other branches fold into the **⋯** menu of the Update card that counts them. Each shows a title ("Rebase of hl/feat-center-home-page stopped") and a short second line that wraps and clamps at three lines ("Conflict in SideBarFooter.tsx, PastDue.tsx and 3 more", "Origin moved"). The full sentence with the file paths stays in Needs you.

**Questions from one Auto run**

When every open question out of view was asked by one Auto run (its root or an agent it started), **Answer open questions** is not a row of its own. It folds into that run's Decide row as "and 2 questions". **Answer** sits in the row's **⋯** menu. Questions from two runs, or from an agent outside Auto, keep their own row.

**Act on a group**

A group can act on its rows at once from its header.

- **Fix** with two or more stuck agents Auto can retry shows **Retry 3**. It counts the stuck agents folded into a branch row too.
- **Retry 3** runs each agent's own **Retry**, so each one reports its own result. A row whose retry fails stays with its error. A second **Retry 3** runs again.
- **Update** with two or more branches behind or stopped shows **Update all 4**.
- One click rebases every behind branch and every stopped one with git, one at a time. It brings origin in on each branch where someone pushed, each with its own lease.
- It never hands a conflict to Auto and never starts the History rewriter. A branch that stops on a conflict stays as its own row with **Resolve with Auto**.
- A branch that fails keeps its row with the error, so its own verb retries it. A second click while it runs does nothing.
- The rebase picker with **Also tidy commits with Auto** stays on the rebase card itself.

**Where a click goes**

A click on a row's title opens its place.

- A stuck agent or a plan opens the Auto step.
- A check, review conversations or a pull request open that tab of the branch.
- Questions open the questions lens. An owner card opens its row.
- A card that spans several branches, like the rebase card, opens nothing.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-light.webp" width="821" alt="The Next block of a session: Split the reconciliation rewrite into six parts, Ready to implement, with a Start button, and Remove the ledger-core worktree, #418 merged, 412 MB, with a Remove button, each with Not now">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Time left

See how long a step has left, estimated from your own past runs. Queued steps show a range, and a run slower than usual turns its time warm. Resting on the time opens a card with the time running, the usual range, the cost and the basis.

### Changes

See and undo what agents changed in a session without a branch.

- In a plain folder agents edit in place. Every writing turn saves what it may change first, shell commands such as `rm` and `mv` and new files included.
- **Changes** in the session rail lists each turn, newest first, with the files it added, changed or removed and their line counts.
- Pick a file to see its text before and after, with the changed words marked.
- **Restore to before turn 3** puts one file back. **Restore turn 3** puts back the whole turn. **Remove this new file** takes out a file the agent created.
- Each restore first saves the text you have now, so **Undo restore** puts it back.
- A restore over text that changed after the turn asks in place before it writes. It names the other agent when a later turn of one wrote the same file (**Scout wrote there after turn 3.**).
- The rail's **Folder** group names the folder and what agents do there.
- The Overview opens on a card that says where agents write and what is saved.
- Each writing turn in the chat ends in a card with **Review changes** and **Restore turn**.
- Versions are kept until 30 days after the session ends. The cap per folder is 1 GB or the folder's own size, whichever is larger.
- The page shows how much they use and what was left out: files over 15 MB, links that leave the folder, dependencies and build output.
- Storage shows their size under **Saved versions**.
- A session that still works in an older session folder keeps its list of file versions under the same page.

## Under the hood

This part is for contributors and agents who change the feature.

- Overview cards: `overviewCardsOf` picks the cards, and an archived session keeps only **Done**.
- Reading the task without a diff: `central/pmReading.test.tsx` walks each of the six points against the cards. `summaryStateOf` words the state line.
- Running card: `liveGroupsOf` orders the rows and `liveSectionsOf` groups them into **Waiting for you**, **Running** and **Stopped**. `liveStatusOf` splits a status word from its cause, and `LiveRow` draws a row and its children with `LIVE_COLUMNS`.
- Done card: `doneSummaryOf` writes the one-line summary, `latestDoneOf` lists the last three items and `DoneCard` draws them.
- Row copy of **Done** and **New since you last looked**: `outcomeLineOf` writes the title (`plainTitleOf`, rule based, no model) and the meta line (`stepsLabelOf`, `needsYouLabelOf`). `runAgentCountOf` is the one agent count that the Runs grid, the subagent summaries and these rows share. `LatestDoneRow` draws the role icon and the provider mark.
- Stuck Auto agent: `StuckActions` offers **Retry**, **Answer** and **Stop**.
- Branches card: `RANK_OF_STATE` in `branchStoryOf` orders the rows, `seriesStripsOf` and `SeriesStrip` draw a series, `mergeSeriesInOrder` merges it and `useMountMenuTarget` opens the branch menu.
- Tracker move suggestion: `trackerMoveSuggestionOf`.
- Archive suggestion: `archiveSuggestionOf`.
- Next groups: `nextGroupsOf`, `NextGroup` and the `next-view` store slice keep the fold state, and `nextUnblockCountOf` orders the rows.
- Next row copy: `planSentenceOf` writes the plan sentence, `nextRowCopyOf` and `useBranchNames` write a **Fix** row, and `rebaseStopRowOf` writes a stopped rebase.
- Folded rows: `foldDivergedIntoStops` in `actionCardsOf` folds a diverged card into its stopped rebase, `historyStopDetailOf` and `foldedVerbOf` word the folded stops, and `MENU_MAX_WIDTH` caps that menu.
- Open questions of one Auto run: `askingAutoRootOf` finds the run, from the `rootAgentId` of the answer-questions suggestion.
- Group actions: `nextBulkOf` offers them and `updateAll` runs **Update all**. `openFor` in `useActionCardActions` and `suggestionPlaceOf` choose where a row opens.
- Time left card: `workTimeCardOf`.
- Changes: `otherWritersOf` names the agent that wrote a file after the turn.
- Files of a turn: `useTurnFiles` and the `files` of a Done row are not mounted in production, so the Overview lists no files per row yet. The app core decides the set: `worktree_turn_files`, saved per turn and branch in `turn_file_sets` by `recordTurnFileSets`. It compares the branch with what it held when the turn began and drops what only the base commits changed. A rebase never pours main's work into the turn. A file the turn committed, edited or fixed in a conflict stays. Work that was already uncommitted before the turn is not the turn's. A turn that ran beside another agent in the same branch records nothing, because the files could be theirs.
