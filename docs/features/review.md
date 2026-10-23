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

Read pull request comments and your own notes in one list in the Comments section. Each row is the button: author and age, then `path:line`, then the comment; a **Note** chip shows only while the list mixes notes and host threads, and the source switch shows only then. The list takes the full width of the page. Group labels carry their row count and no verbs, and the Open and Resolved switch shows only once a comment is resolved. **Fix N comments** in the Branch header is the one page action, beside Push (`ReviewList`, `ReviewListRow`, `commentsCountOf`).

Open a comment to read it in the drawer beside the list, the same way a failing check opens the Debugger. The drawer holds the code around the line, then the comment and its thread, then its actions at the end: **Fix** as the primary, **Reply** and **Skip** beside it, each with its key (F, R, S), and a `⋯` only when two or more rarer verbs remain (`ReviewCommentDrawer`, `CommentDrawerActions`). J and K, or the arrow keys, move to the next or previous comment while it is open, and Escape closes it on the row you were on. A verb that fails says why under the actions and its button reads **Retry**. The open comment survives a refresh of the list and a window reload. Reading and replying work on every host, and a Bitbucket thread stays open because Bitbucket cannot resolve it.

### Comment states

See what each comment needs next. The list groups comments under **Needs you**, **Working**, **Ready to push**, **Done** and **Left open**, and each comment names its state, such as **Question for you**, **Fix ready** or **Failed**. If the reviewer edits a comment after the agent drafted an answer, you choose to redraft or keep the draft.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-light.webp" width="532" alt="The comment list of the Branch page grouped as Needs you 5, Working 1, Ready to push 1 and Open, each row with its author, age, file and line, and its state at the right: Question for you, Push failed or Fix ready">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Failed drafts

When a fix fails, the comment says why in one sentence and links to the agent's transcript. Retry it in the same run, start over with a new agent, try another model or add a hint.

### See what a resolve did

Open a fix run from Activity or from a comment to see what the agent did. A drawer beside the list has two tabs. Fix shows the status, the comments the run covers, what it did and its commits. Transcript shows the whole conversation, and you can write to the agent from there. It opens on Transcript while the run works, and on Fix once it ended or when it asks a question. A dot on the other tab tells you when something new happens there.

### Hints when a fix starts

Tell the agent what to weigh before a fix starts. Every start that launches a fix has one quiet line, **Add a hint**, above its buttons: Fix comments (`apps/desktop/src/features/resolve/components/FixCommentsDrawer/index.tsx`), **Start fix** in the Debugger drawer (`apps/desktop/src/features/branch/components/CheckAnalysisDrawer/ProposedFix.tsx`), **Analyze again** on a failing check (`apps/desktop/src/features/branch/components/CheckAnalysisHint.tsx`), **Fix with agent** after a failed push and **Rewrite with an agent** on a conflict. The line is closed by default and never required. A click opens an unboxed field, **Hint for the agent** (**Hint for the Implementer** for a fix), that grows to six lines, shows a small counter near 2000 characters and clears with an x. **Esc** closes the open popover first, then the field with its text kept, then the page. The first **Analyze** of a failing check stays one click with no field.

The hint goes to the agent as typed, trimmed, after the rules and after the evidence under **Operator notes**, with one line that ranks it below the role and the tool limits and asks the agent to say in a sentence how it applied it. It is never posted to GitHub, GitLab or Bitbucket. The first message of the run shows it once as **Your hint**. The draft lives in memory, per session and per target, and clears only once the agent's first turn has started: a failed start keeps it, and text typed while the start is pending stays. A **Retry** on a failed comment reuses the hint of the request that failed.

### Fixes already on the branch

Goodboy checks origin before it pushes. A comment already fixed by a commit you pushed, or by a teammate's commit, offers **Reply and resolve** instead of a new fix.

### A fix that went missing

If a fix commit is no longer on the branch, for example after a squash done elsewhere, the comment reads **Fix went missing**. Goodboy asks git first, then can ask a read-only agent whether the fix is still needed. Nothing is closed or fixed without you.

### Close on GitHub

Finish a review with **Push N fixes** in the Branch header. It always covers every ready comment. When nothing needs a decision it pushes on that click and says what went out in one line. Otherwise a preview counts the fixes, replies and threads to resolve and the one **Push** in it sends them to GitHub or GitLab. **Push only this one** in a comment's actions sends just that fix and hides while the preview is open. A reply with no code change goes out right away when no fix is waiting.

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

Review your own diff before anyone else does. Leave notes on lines or whole files in the **Files** section, where each file header keeps **Viewed**, **Comment** and one menu with open in your editor, copy the path and show the whole file in a drawer. Resting on the path opens a fact card (`fileCardOf`) with the file name, its status, its folder and, for a rename, where it came from. Then hand the open ones to an agent with **Fix comments** or move one into your GitHub review with **Post to GitHub**. Notes stay on their branch, and notes with no branch wait on the Session overview.

### Pull request on the Branch page

Click a worktree under **Projects** in a session and the session rail steps into it: the project and the branch on top, a status line with **Rebase** while the branch is behind, then **Pull request**, **Comments**, **Files** (with the lines added and removed beside the file count), **Commits** and **Checks** with their counts. **‹** goes back to the session. The session level already lists **Pull request**, **Comments**, **Files** and **Checks** under each branch, so one click opens the diff or the checks of any branch. **Pull request** shows the number beside it and **Commits** how many are not pushed, such as **↑3**. A click on another branch row lands on its Pull request, the branch page when it has none yet.

The **Pull request** entry is the pull request. The line under the title says its state, number and base once. A strip of four cells comes first: **Checks**, **Review**, **Merge** and **Branch**, each one word and one detail, such as **1 failing** with the check's name, **Waiting on dana-r**, **Blocked by checks** or **7 behind main**. The Checks cell opens the checks. The description and the activity read in a column of comfortable width; reviewers, author and linked issues sit beside it, the person you asked first with their verdict next to the name, and bots that only commented in their own group. Rename it, edit the description and ask for reviewers there. The header holds one next step, never a disabled button: **Request review** while nobody was asked, **Fix checks** or **Fix comments** while something needs fixing, **Squash and merge** once it is ready. Anything blocked waits in **⋯** with its reason. Merge, mark ready, reopen, convert to draft and close act on the repository of the branch on screen, never on another repository of the session. **Merge** offers only the ways the host allows, and on GitLab the page uses GitLab's words, such as **Merge request** and **MR !42**.

The page shows the pull request of the branch you opened, even while a rebase runs on it or the session writes to another branch. The form for a new pull request appears only when the host reports none for that branch; an empty or failed answer keeps the one already known.

A branch with no pull request gets its own page: the branch name, whether it is pushed and how far it is ahead and behind its base, then one next step. **Push 3 commits** while the commits are only on your machine, **Rebase on main** while the branch is behind, and once it is pushed and up to date the form's **Create pull request**. The form is filled from the branch: one commit gives its headline as the title, several give the linked issue and the first headline, and the description lists the commits. It always opens the pull request from the branch on screen. While a rebase is stopped on conflicts the form waits and the conflicting files are listed instead.

The page shows the pull request of the branch you opened, even while a rebase runs on it or the session writes to another branch. The form for a new pull request appears only when the host reports none for that branch; an empty or failed answer keeps the one already known.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-light.webp" alt="The Pull request tab of the Branch page for hl/fix-duplicate-credit, between the tabs Pull request, Comments, Files 6, Commits 3 and Checks 1, with the state Open #318, the base, Checks 1 failing, Readiness Blocked by lint, reviewers, the linked issue, the description with its Edit button and the Activity list">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### One trail to the Branch page

Every way into a branch, from the palette, a notification, a chat card or the board, opens the same Branch page with the session rail stepped into that branch. The rail's back row steps out to the session, and **Back** walks your history.

### Write it

Get a pull request title, description and changelog entry in your repo's format, then Goodboy pushes the branch and opens the pull request. Linked issues become closing references. If a step fails, the reason shows next to **Retry** and the text is kept.

### PR description follows the push

A description Goodboy wrote is updated after a history push, so it keeps matching the branch. A description you edited yourself is left alone.

### Read the code

Read the branch against its base in **Files**, unified or split. The changed files sit in a list on the right of the diff that tracks what you marked **Viewed**, with a filter, **All**, **Unviewed** and **Commented** in one menu and **Next unviewed** at its top. Drag its edge to make it wider or fold it away; it stays that way, and **Files** in the diff toolbar brings it back. Quote lines into a note, or choose **Ask agent** to send them to an agent with your question. The Branch header refreshes after a local commit edit; **Force push** waits in **⋯** behind its confirm.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-light.webp" alt="The Files tab of the Branch page for hl/fix-duplicate-credit with a diff of ledgerClient.ts and postCredit.ts, each file header with Viewed and Comment, and on the right the file list with Next unviewed 6, a filter box and the changed files in a tree with their added and removed lines">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Write review

Review someone else's pull request from its diff. Click a line number to leave a comment, then press **Review** to choose **Comment**, **Approve** or **Request changes** and add a summary. GitHub receives it as one review.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-light.webp" alt="The Files diff with the Review panel open: Line comments 1 for src/webhooks/applyWebhook.ts:26, a Verdict of Comment, Approve or Request changes, an optional Summary, GitHub shows it as one review, and a Submit comments button" width="800">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

**Also in this area**

| Feature            | What it does for you                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Written by Goodboy | Comments Goodboy posts end with a line that says so, and a setting turns it off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Resolve again      | Rereads a comment and tries the fix once more                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Checks             | Lists CI checks in one grid grouped Failing, Running, Passed and Skipped, each group label carrying its count (`PrChecks`, `CheckRunRow`), with no summary line. Resting on a row opens a fact card (`checkCardOf`) with the name, the result and the time it took, and a footnote saying where the click leads; it never shows the address. **Analyze** is the one verb on a failing row and asks the Debugger why it failed; once a Debugger exists the row opens its drawer and reads a short state (**Analyzing**, **Fix proposed**, **Fixing**, **Not pushed**, **Re-running**) through `features/branch/components/AnalyzedCheckRow.tsx`. **Start fix** and **Push** live in the Debugger drawer (`pushCheckFix.ts`), which leads with the outcome line (`ciFixOutcomeOf.ts`), then the steps (`ciFixStepsOf.ts`), Finding and Proposed fix, and one model line beside Start fix. Running reads in the info tone, a fix that waits on your push in warning. The Checks property, readiness, the activity row and the worktree entry read one word, `checksWordOf` (`2 failing`, `1 running`, `5 passed`) over `pullRequestRunsOf` |
