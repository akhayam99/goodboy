# Review and resolve on the Branch page

The Branch page holds one branch: its pull request, review comments, changed files, commits and checks. Use it to read your own diff, let an agent turn review comments into commits and send everything back with one push. It works the same on GitHub, GitLab and Bitbucket.

### Resolve

Turn review comments into commits without writing the fixes yourself. Check the comments you want and press **Fix**: one agent works through them in its own copy of the branch and ends each one with a fix, a reply or a question. You accept, edit or skip each result, and nothing leaves your machine until you push.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-light.webp" alt="The Comments tab of the Branch page for PR #318 with the buttons Fix 1 comment, Push 1 fix and Merge, the strip Fixing 4 comments with Stop and View transcript, and the comments grouped as Needs you 4, Working and Ready to push, each with its state at the right">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Bulk actions

Handle many comments at once. **Fix comments** checks every open comment, **Use the recommended answers** answers the agent's open questions in one go, and **Apply fix** takes every waiting fix, with **Undo** right after.

### Review sources

Read pull request comments and your own notes in one list in the Comments section. Each row is the button: author and age, then `path:line`, then the comment; a **Draft** chip shows only while the list mixes notes and host threads, and the source switch shows only then. Group labels carry their row count and no verbs, and the Open and Resolved switch shows from the first comment on. One header button follows the state: **Fix N threads**, **Apply N fixes**, **Push N commits** or **Request review**. A line at the list end counts unpushed commits.

The Open and Resolved switch carries a count on each side, and its Open count is the one the Comments tab carries. A bot comment reads as its first plain line: headings, HTML comments, severity badges and boilerplate are left out.

Open a comment to read it in the drawer beside the list, the same way a failing check opens the Debugger. The drawer holds the code around the line, then the comment and its thread, then its actions at the end: **Fix** as the primary, **Reply** and **Skip** beside it, each with its key (F, R, S), and a `⋯` only when two or more rarer verbs remain. J and K, or the arrow keys, move to the next or previous comment while it is open, and Escape closes it on the row you were on. A verb that fails says why under the actions and its button reads **Retry**. The open comment survives a refresh of the list and a window reload. Reading and replying work on every host, and a Bitbucket thread stays open because Bitbucket cannot resolve it.

### Comment states

See what each comment needs next. The list groups comments under **Needs you**, **Working**, **Done** and **Left open**, and each comment names its state, such as **Question**, **Fix ready** or **Failed**. If the reviewer edits a comment after the agent drafted an answer, you choose to redraft or keep the draft.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-light.webp" width="532" alt="The comment list of the Branch page grouped as Needs you 5, Working 1, Ready to push 1 and Open, each row with its author, age, file and line, and its state at the right: Question for you, Push failed or Fix ready">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Failed drafts

When a fix fails, the comment says why in one sentence and links to the agent's transcript. Retry it in the same run, start over with a new agent, try another model or add a hint.

### See what a resolve did

Open a fix run from Activity or from a comment to see what the agent did. A drawer beside the list has two tabs. Fix shows the status, the comments the run covers, what it did and its commits. Transcript shows the whole conversation, and you can write to the agent from there. It opens on Transcript while the run works, and on Fix once it ended or when it asks a question. A dot on the other tab tells you when something new happens there.

A comment a fix run covers says where it stands on its row. While the run works the row reads **In the fix run**. When the fix is ready it reads **Fixed in 90b1d57 · Review the fix**. An **Open changes** link opens the Changes of the branch on that commit. A comment the run could not fix says why in one sentence. The state comes from the thread, so it is still there when you leave the Comments tab and come back. Starting a fix takes its comments out of the selection. Leaving the list drops a selection that sits on comments nobody can act on.

When the run has finished with fixes ready, its comments move into one group above the rest of the list. The header reads **Fix run finished: N fixes ready for you**. It says what Apply does: it accepts the fixes, then the next push sends them, replies to the threads and resolves them where the host can. It holds **Apply N fixes**. Comments no run covers stay in their normal groups.

When the agent says its checks did not run, the group and the Fix tab of the run drawer show **Checks were skipped: <reason>**. An example is dependencies missing from its copy. Goodboy reads the agent's final message for it. When the reason names dependencies, or the worktree of the branch is missing them, the warning offers **Reinstall dependencies**. It installs them in that worktree so the next fix run can check.

### Hints when a fix starts

Tell the agent what to weigh before a fix starts. Every start that launches a fix has one quiet line, **Add a hint**, above its buttons: Fix comments, **Start fix** in the Debugger drawer, **Analyze again** on a failing check, **Fix with an agent** after a failed push and **Rewrite with an agent** on a conflict. The line is closed by default and never required. A click opens an unboxed field, **Hint for the agent** (**Hint for the Implementer** for a fix), that grows to six lines, shows a small counter near 2000 characters and clears with an x. **Esc** closes the open popover first, then the field with its text kept, then the page. The first **Analyze** of a failing check stays one click with no field.

The hint goes to the agent as typed, trimmed, after the rules and after the evidence under **Operator notes**, with one line that ranks it below the role and the tool limits and asks the agent to say in a sentence how it applied it. It is never posted to GitHub, GitLab or Bitbucket. The first message of the run shows it once as **Your hint**. The draft lives in memory, per session and per target, and clears only once the agent's first turn has started: a failed start keeps it, and text typed while the start is pending stays. A **Retry** on a failed comment reuses the hint of the request that failed.

### Fixes already on the branch

Goodboy checks origin before it pushes. A comment already fixed by a commit you pushed, or by a teammate's commit, offers **Reply and resolve** instead of a new fix.

### A fix that went missing

If a fix commit is no longer on the branch, for example after a squash done elsewhere, the comment reads **Fix went missing**. Goodboy asks git first, then can ask a read-only agent whether the fix is still needed. Nothing is closed or fixed without you.

### Close on GitHub

Finish a review with **Push N fixes** in the Branch header. It covers the comments of the branch on screen, and the confirm names the repository (`Push 2 commits to hl/fix-duplicate-credit in payments-api?`) when the session has more than one. It always covers every ready comment. When nothing needs a decision it pushes on that click and says what went out in one line. Otherwise a preview counts the fixes, replies and threads to resolve and the one **Push** in it sends them to GitHub or GitLab. **Push only this one** in a comment's actions sends just that fix and hides while the preview is open. A reply with no code change goes out right away when no fix is waiting.

When a check of the repository stops the push, the failure card names the check and shows its first findings. **Fix with an agent** starts an agent on the same branch that fixes what the check reports without skipping it. The card follows that agent. It keeps following it when you leave the page and come back, or reload the window. It shows the agent working. When the agent ends, it shows whether the fix was pushed and what the replies or the pull request did next, or why the agent did not finish. When the agent finishes, Goodboy pushes and sends the replies, or opens the pull request with the text you wrote.

The page says so before you push if the worktree has no dependencies installed or reads them from another folder. The failure card then offers **Reinstall dependencies**. It installs them in that worktree with the install command of its lockfile, shows the progress and retries the push.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-light.webp" alt="The header of the Branch page with its Fix 1 comment, Push 1 fix and Merge buttons, and under it a confirm: Push 2 commits to hl/fix-duplicate-credit, 1 fix in 1 new commit, 1 reply, 1 thread resolved on GitHub, 1 comment needs you first, with Cancel and Push buttons">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Review replies in your voice

Choose the tone of the replies the agent drafts: **Terse**, **Friendly**, **Formal** or **Your replies**, which learns from your last 20 review replies. You can edit the style note it writes.

### Fixes on a branch that moved

Accept a fix even after the branch got new commits. It lands on top of the latest one, and on a conflict the branch goes back to its old head.

### Squash and fold the resolve commits

Tidy the fix commits before reviewers see them, in the **Commits** section. Fold a fix into the commit it belongs to, squash, reword or drop it, with a backup kept. **Undo rewrite** restores the branch and puts every comment back on its commit.

### Notes before a pull request

Review your own diff before anyone else does. Leave notes on lines or whole files in the **Changes** section, where each file header keeps **Viewed**, **Comment** and one menu with open in your editor, copy the path and show the whole file in a drawer. Resting on the path opens a fact card with the file name, its status, its folder and, for a rename, where it came from. Then hand the open ones to an agent with **Fix comments** or move one into your GitHub review with **Post to GitHub**. Notes stay on their branch, and notes with no branch wait on the Session overview. Every comment box here, in Write review and in the resolve flow is the same field: **⌘Enter** saves, **Esc** cancels only that box, and the replies under a comment fold to a count when there are more than two.

### Pull request on the Branch page

Click a branch under **Projects** in a session and the Branch page opens on **Overview**, the branch page when it has none yet. The tabs under the title are the way around it: **Overview**, **Comments**, **Changes**, **Commits**, **Checks** and **Work**. Each tab carries its count in gray, and color only for what wants you, such as the comments that need you and the checks that fail. The Session pages stay on the session, so any other branch is one click away.

The **Overview** tab is the pull request. The title carries its state, and the line under it says the number, the branch, the base and who opened it, and when. A merge box comes first and answers whether it can merge: **Not ready to merge** with the next two steps in the order the header takes them, **Waiting for a review**, **Ready to merge** with what the header button does, **Draft** or **Merged into main**. Under it each thing that holds the merge gets one row, the worst first, such as **1 check failing** with the check's name, **Changes requested by omar-t** or **3 commits behind main**, and a click opens where you fix it: Checks, Comments, Changes or Commits. Everything that passes folds into one quiet line you can open. The box never holds the merge button: the header keeps it. The tabs carry the rest: **Changes** and **Commits** show their count on the tab, and the same count heads their list. When review threads are open, a row of the merge box such as **2 threads need you** with **6 open threads · 2 unread** opens Comments. It counts the threads Comments lists for that pull request, and the dots in Comments come from the same count. A thread is unread when you never saw it in Comments. It is also unread when someone else wrote in it after you last saw it. A reply you wrote never makes a thread unread, and a thread only you wrote never is. Opening Comments marks the unread threads with a small dot in the left margin of the row. The dots stay while Comments is open, also when you switch between Open and Resolved or a reply arrives. The threads count as read from then on, up to the latest comment you were shown. The dots are gone on your next visit, and the row drops them. Both windows read the same record. After the update every thread that already existed counts as read. To tell your replies, Goodboy needs your name on the host: GitHub gives it through the status of the workspace. GitLab gives it through the username kept when you connected to that host. Bitbucket gives it through its nickname. Only that login counts, never a display name. An account of another workspace or host never stands in for it. Goodboy reads that name again from the host when you connect and when the app starts. An older GitLab or Bitbucket connection fills it in by itself. When the host refuses, the integration page starts with "Unread needs your username." and a **Reconnect** button. Comments shows one quiet line until the name is known. Until the name is known, or while the comments have not loaded, the row shows no unread part. A host that gives no author or time keeps the thread unread until you open Comments once. The description and the activity read in a column of comfortable width, and a long description folds after five lines behind **Show all**; reviewers, linked issues and author sit beside it, the person you asked first with their verdict next to the name, and every bot in its own **Bots** group with one word, such as **1 issue** for the open threads it started. On GitHub a review app is known as a bot by its author type even when its name has no bot suffix. Rename it, edit the description and ask for reviewers there. The header holds one next step, the same on every tab, never a disabled button. It answers a question first, then applies the waiting fixes, fixes the comments, pushes once, fixes the checks still red, and last asks for a review or merges. **Fix checks** starts a Debugger at the first press, and resting on it names the model. Once the Debugger proposes a fix the step reads **Start fix**, then **Push fix**. While an agent works the header has no filled button, and a line under the tabs says what runs, with **Stop**. Anything blocked waits in **⋯** with its reason. Merge, mark ready, reopen, convert to draft and close act on the repository of the branch on screen, never on another repository of the session. Reviewers, linked issues and the text Scribe writes go to that repository too, and a review request the host refuses says why under the list. **Merge** offers only the ways the host allows and is tied to the commit you reviewed on GitHub, GitLab and Bitbucket: if the branch moved since, nothing merges and the page asks you to refresh and review again. On GitLab the page uses GitLab's words, such as **Merge request** and **MR !42**. While commits are only on your machine and no comment waits, **Push 3 commits** is the one primary and the merge waits, with **3 commits not pushed** in the merge box.

The page shows the pull request of the branch you opened, even while a rebase runs on it or the session writes to another branch. The form for a new pull request appears only when the host reports none for that branch; an empty or failed answer keeps the one already known.

A branch with no pull request gets its own page: the branch name, whether it is pushed, how far it is behind its base when the base moved, a declined pre-push hook when there is one, then the form. **Push and create pull request** is the one primary while the commits are only on your machine, with **Push 3 commits** beside the title for a push alone. **Rebase on main** leads while the branch is behind, and once it is pushed and up to date the form's **Create pull request** does. The form is filled from the branch: one commit gives its headline as the title, several give the linked issue and the first headline, and the description lists the commits. It always opens the pull request from the branch on screen. When origin also holds commits the branch lacks, the branch reads **Diverged** (never Pushed) and the form offers **Force push and create pull request** behind the same confirm as **Force push**. While a rebase is stopped on conflicts the form waits and the conflicting files are listed instead.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-light.webp" alt="The Pull request tab of the Branch page for hl/fix-duplicate-credit, between the tabs Pull request, Comments, Changes, Commits and Checks 1, with #318 into main by nadia-p and the Fix checks button, the cards Checks 1 failing, Review Changes requested, Merge Blocked by checks and Branch 3 behind main, the reviewers, the author, the linked issue, the description with its Edit button and the activity down to Checks 1 failing and 9 comments on files">
</picture>

<sub>Screenshot from Goodboy 0.31.12</sub>

### Work behind a branch

The **Work** tab shows what Goodboy did on the branch: its runs, its questions, answered ones folded with their answer, and its plans and reports. They are the same rows as the session's Runs, Questions and Artifacts pages, so the counts always match. Its badge counts what waits for you in color, else the runs still working, else everything on the branch in gray. Open a run or an artifact and **Back** returns to the tab. **All runs**, **All questions** and **All artifacts** open the whole session page on this branch, grouped the way you left it, and **Open branch** on those pages lands on this tab.

### One trail to the Branch page

Every way into a branch, from Search or run, a notification, a chat card or the board, opens the same Branch page, and the session pages stay on the session. **Back** walks your history.

### Write it

Get a pull request title, description and changelog entry in your repo's format, then Goodboy pushes the branch and opens the pull request. Linked issues become closing references. If a step fails, the reason shows next to **Retry** and the text is kept. A retry never opens a second request: when the host already has one for the branch (the first try landed but Goodboy could not save its link, or someone opened it meanwhile), Goodboy links that one, and when only the saving failed it still returns the number with a warning, **Opened #14, but Goodboy could not save the link**, so **Refresh** picks it up.

### PR description follows the push

A description Goodboy wrote is updated after a history push, so it keeps matching the branch. A description you edited yourself is left alone.

### Read the code

Read the branch against its base in **Changes**, unified or split. The changed files sit in a list on the right of the diff that tracks what you marked **Viewed**, with a filter, **All**, **Unviewed** and **Commented** in one menu, and **Viewed 2 of 6** with **Next** at its top. Drag its edge to make it wider or fold it away; it stays that way, and **Changes** in the diff toolbar brings it back. Quote lines into a note, or choose **Ask agent** to send them to an agent with your question. The Branch header refreshes after a local commit edit; **Force push** waits in **⋯** behind its confirm.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-light.webp" alt="The Changes tab of the Branch page for hl/fix-duplicate-credit with a diff of ledgerClient.ts and postCredit.ts, each file header with Viewed and Comment, and on the right the file list with Viewed 0 of 6 and Next, a filter box and the changed files in a tree with their added and removed lines">
</picture>

<sub>Screenshot from Goodboy 0.31.12</sub>

### Write review

Review someone else's pull request from its diff. Click a line number to leave a comment, then press **Review** to choose **Comment**, **Approve** or **Request changes** and add a summary. GitHub receives it as one review.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-light.webp" alt="The Changes diff with the Review panel open: Line comments 1 for src/webhooks/applyWebhook.ts:26, a Verdict of Comment, Approve or Request changes, an optional Summary, GitHub shows it as one review, and a Submit comments button" width="800">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

**Also in this area**

| Feature            | What it does for you                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Written by Goodboy | Comments Goodboy posts end with a line that says so, and a setting turns it off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Resolve again      | Rereads a comment and tries the fix once more                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Checks             | Lists CI checks in four groups: Failing, Running, Passed and Skipped. Each group has its count, with no summary line. Rest on a row to see its name, the result and the time it took, with a footnote saying where the click leads. **Analyze** on a failing row asks the Debugger why it failed. The row opens its drawer and reads **Analyzing**, **Fix proposed**, **Fixing**, **Not pushed** or **Re-running**. **Start fix** and **Push** are in the Debugger drawer. It leads with the outcome line, then the steps, Finding and Proposed fix, and one model line beside Start fix. The Checks property, readiness, the activity row and the worktree entry read one word: `2 failing`, `1 running` or `5 passed`. |

## Under the hood

This part is for contributors and agents who change the feature.

- Comments list: `ReviewList`, `ReviewListRow` and `commentsCountOf` draw the list and the count on **Fix N threads**.
- Unread threads: `unreadThreadsOf` is the one function. It joins the threads to the comments of the selected source, keeps the threads `rowBelongsToSource` lists, and returns null while the reads or the viewer identity are not loaded. `useUnreadThreads` feeds it to `usePullRequestReadiness` (the line) and to `useThreadVisit` (the dots). `ReviewFlowVisit` mounts `useThreadVisit` above `ReviewFlow` and gives the visit snapshot to `ReviewList` through `ThreadVisitContext`, so it survives the Resolved switch and an empty list. A write is deduped only while it is in flight.
- Read record: the `thread_reads` table (m239), keyed by session and host thread id, behind the `store/slices/thread-reads` slice. m239 backfills one row per existing `resolve_threads` row at the migration time. `read_at` is the latest time of a comment by someone else among the shown ones, falling back to the fetch time, and the upsert keeps the `MAX`. Memory changes only after the write succeeds and only inside an entry that a load created. A load merges with `max` per thread, so a late load never undoes a mark, and a late `loadThreadReads` answer is dropped.
- Viewer identity: `viewerIdentityOf` reads the connection that serves the selected source. That is the GitHub status of the session workspace, with the default status only when the workspace has no scoped token. It is the GitLab `username` of the binding for that workspace, project and host. It is the Bitbucket `nickname` of the binding for that workspace and project. Only that canonical id counts, never a display name. It returns null when that connection has none, even if another connection has one, and the unread logic waits.
- Identity health: `viewerBindingOf` picks the binding. `identityHealthOf` turns a missing name into the one line and the Reconnect action. `IdentityHealthLine` shows it on the integration page. `IdentityQuietLine` shows the quiet line in Comments. `refreshViewerIdentity` re-reads the name from the host, with no token sent, whenever `loadIntegrations` runs. `useThreadVisit` takes `isVisible`, the Branch page `isActive`, false while the agent overlay covers it. It takes no snapshot and sends no write while that is false.
- Comment drawer: `ReviewCommentDrawer` and `CommentDrawerActions`.
- Verdict steps: the merge box names the first two entries of `branchStepsOf`, the list whose first entry is the header step.
- Next step: `branchStepOf` picks the Branch header step on every tab, from the comment facts of `useBranchReview` and the check chain of `useBranchCheckStep`. `checkChainActionOf` runs Fix checks, Start fix and Push fix for the header and the Overview row alike. `BranchWorkLines` draws the line with Stop.
- Fix run state: `rowFixOf` gives a row its Fixing, Fixed in sha or failed line. `fixRunReadyOf` picks the fixes the fix run group header offers. `dropLaunchedSelection` runs in `startBatch`. `checksSkippedOf` reads the skipped checks and `isMissingDepsReason` tells when the reason is about dependencies.
- Add a hint: `apps/desktop/src/features/resolve/components/FixCommentsDrawer/index.tsx` (Fix comments), `apps/desktop/src/features/branch/components/CheckAnalysisDrawer/ProposedFix.tsx` (**Start fix**) and `apps/desktop/src/features/branch/components/CheckAnalysisHint.tsx` (**Analyze again**).
- Fact cards: `fileCardOf` builds the card on a file path and `checkCardOf` the card on a check row.
- Checks: `PrChecks` and `CheckRunRow` draw the grid, and `features/branch/components/AnalyzedCheckRow.tsx` reads the state of an analyzed row. `pushCheckFix.ts` pushes the fix, `ciFixOutcomeOf.ts` writes the outcome line and `ciFixStepsOf.ts` the steps. `checksWordOf` words the checks over `pullRequestRunsOf`.
