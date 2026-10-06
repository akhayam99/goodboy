# Review and resolve on the Branch page

One Branch page per branch holds the Comments, Files, Commits and Checks tabs. Turn review comments into commits with a Fix run, push them back with one Push, and read your own diff and notes before anyone else does.

### Resolve

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-light.webp" alt="The Comments tab of the Branch page for PR #318 in Harborline, with six open comments on the left and the one from kenji-w on retryPolicy.ts:42 on the right, marked Ready, with a Proposed change that caps the retries in retryPolicy.ts and metrics.ts">
</picture>

Turn review comments into commits without writing the fix yourself. The Comments tab lists the comments on the left and the one you picked on the right. Press **Fix** on a comment (or **F**), or check the comments you want (the box that shows on hover, **X** or **Cmd+A**) and press **Fix N** in the bar at the bottom of the list. A panel opens in the right column in place of the thread, so the page does not move: the comments it covers, with a check to drop any, the model it runs on with **Change**, and an optional note for the run. **Start fixing N** begins, Esc closes it, and the list keeps the comment you had open. **Fix** on a single comment opens the same panel for that one. One agent works through the comments in order, in its own copy of the branch. It writes each fix as its own commit and drafts the reply, then you accept it, edit it, reply yourself or skip the comment, each on its own. Accepting puts the fix on your branch; if it collides with a fix you accepted before, the branch stays as it was and the comment says to redo it on top. While a run is going, one line under the tabs says what it is doing: **Fixing 9 comments**, the tally (**5 ready · 1 needs you · 2 working · 1 couldn't fix**, each a filter for the list), the model it runs on (**Sonnet 5.5 · Medium**), **Open transcript** and **Stop**. The list is grouped by the five words, **Needs you** first, with **Done** closed. The agent asks only when a comment reads two ways that lead to different code: the question shows in that comment's thread as **Question from the fix run**, with its options (the one it recommends is marked), a field for **Or tell it something else** and one **Continue the fix run**. The same question shows at the top of the fix run transcript, which opens in a drawer on the right of the Comments tab, so the list and the thread stay where they are. Answering a question, retrying a comment that could not be fixed and writing to the agent all go to that same agent, in the same copy. A retry keeps the model, commit style and hint the comment started with; pick another model and the comment starts over as a new fix run.

### Bulk actions

Fix, answer and accept many comments at once. With no fix run going, the line under the tabs reads **9 open comments** with **Fix 9 open comments**: it checks every comment you can fix, the open ones and the ones that could not be fixed, and opens the launch panel. **Cmd+A** checks the same set. A comment that needs you stays out, because you answer it instead. **Draft fixes for 9** on the Overview and **Resolve 9 comments** on a Board card open that same panel on the Comments tab with the same comments checked, and never start a run by themselves.

While a run is going and two or more questions are open, **Use the recommended answers (2)** shows in the line under the tabs, next to the model. A panel opens in the right column with each question and its recommended answer already chosen. Pick another answer, or **Drop** a question to leave it in Needs you, then **Continue with 2 answers** sends them all to the same run. **Retry 1 that couldn't fix** retries every comment that could not be fixed, in the same run and the same copy of the branch.

The **Ready** group has **Accept 5** next to its name, and with ready comments checked the bar at the bottom says **Accept 3**. A bar **5 accepted** with **Undo** appears right after, and **Cmd+Z** does the same: the comments go back to Ready. Nothing leaves your machine until **Push**, and **Push 5** in the header stays the one place that pushes.

### Review sources

Read the comments of a branch and your own notes in one list, the Comments tab of the Branch page. Each comment carries a label, **Local**, **GitHub**, **GitLab** or **Bitbucket**; there is no source picker. Draft, reply and push work the same everywhere. Where a provider cannot resolve a thread, the comment offers **Reply** and no resolve, and the push confirm says the thread stays open for the reviewer.

| Source                 | Read comments   | Reply | Resolve thread            |
| ---------------------- | --------------- | ----- | ------------------------- |
| GitHub pull request    | Yes             | Yes   | Yes                       |
| GitLab merge request   | Yes             | Yes   | Yes                       |
| Bitbucket pull request | Inline comments | Yes   | No, the thread stays open |
| Local notes            | Yes             | No    | Close the note            |

### Comment states

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-light.webp" width="420" alt="The comment list of the Branch page for PR #318 under the summary 6 open, 1 drafting, 1 ready to push, 2 done, with a filter menu and the groups Open 6, Ready to push 1 and Done 2, each row marked Comment changed, Needs you, Drafting, Ready, Not started, Accepted, Skipped or Pushed">
</picture>

Know what each comment needs next. A comment in a fix run shows one of five words, **Working**, **Needs you**, **Ready**, **Couldn't fix** or **Done**, and a comment not yet in a fix run reads **Open**. The list groups by those words with **Needs you** on top and **Done** closed. A working comment shows how long it has been going and its last step; a ready one shows the change, the reply and **Accept**, **Edit reply** and **Skip**. What git says, **Checks failed** and **Comment changed** are small notes next to the word. A comment is marked changed only when the reviewer really edited the original comment after the draft (a new reply shows as **New reply from** the author and never blocks Accept): the card shows the text before and after and who wrote it, and you choose **Redraft with the new comment** or **Keep the draft**. A comment whose line moved on GitHub says so, and stays as it is.

### Failed drafts

Know why a fix could not be made and what to do next. A run that ends without a result is never a failure: the agent's own last message shows as the question, under **Needs you**. When a fix really failed, the comment says why in one sentence from the cause Goodboy recorded: it did not start, the provider stopped it, every provider is over its spend cap, you stopped it, the app closed, it conflicts with a fix you accepted, the worktree is gone, or the fix could not be saved. Comments from before 0.20 say the cause was not recorded. It also shows the last command the agent ran and how it ended, and links to the transcript. **Retry in this run** continues the same run in the same copy of the branch for that one comment; **Start over with a new agent** begins a new run; the **⋯** menu holds **Try another model** (picks which model a new agent uses) and **Add a hint** (retries with a note). Earlier attempts fold into one line above. When a push fails because the branch on origin moved, the result under the header offers **Sync and try again**, which asks first, brings the new commits under yours, and stops without touching anything if they conflict.

### See what a resolve did

Click a resolve in Activity, **Open transcript** on the run line or **Agent transcript** on a comment, and the fix run opens in a drawer on the right of the **Comments** tab, never on a page of its own, so the list and the thread stay where they are. The drawer shows what the resolver did, the commits it made and the comments it touched, each a link to that comment, then the whole conversation and a field to write to the agent. Accept, reply and push stay in the comment, where **Push** names the commits that would go with a fix. A resolve that fixed several comments together says so, and **Open them in Comments** shows just those. A question the run is waiting on shows at the top of the drawer, with the same options as in the thread. Activity has one row per run, **Fix run · #318 · 9 comments**, with the tally, the model, the time and the cost.

### Fixes already on the branch

The Branch page looks at origin before it pushes. A comment whose fix you already pushed reads **Already on origin**, and one that someone else's commit seems to have fixed reads **Looks fixed** with the commit and its author. Both offer **Reply and resolve** and never push. If you already answered a thread yourself it reads **You replied** and offers **Resolve only**. On a Bitbucket pull request, where a thread cannot be resolved, the same moves read **Reply** and **Post this reply**, and there is no **Resolve only**.

### A fix that went missing

When the commit of a fix is no longer on the branch or on origin, the comment reads **Fix went missing** with its own detail, and the push blocker points to it. Goodboy first asks git without an agent: the same patch under another sha turns it into **Folded in**: it stays in the push (the header **Push**) and its reply, "Fixed in the old sha, squashed into the new one", goes out after the push lands. If that is not enough, **Re-check** starts a read-only agent on the cheapest model of your provider. It answers **Already fixed here** (Reply and resolve with the sha), **No longer relevant** (Close with this reply, editable) or **Still needed** (Fix again, Add a hint). A verdict never closes or fixes anything by itself. A pushed fix that origin lost later, after a force push or a squash done elsewhere, gets the same check.

### Close on GitHub

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-light.webp" alt="The header of the Branch page for PR #318 with its summary line, and under it a confirm: Push 1 to hl/fix-duplicate-credit, 1 fix in 1 new commit, 1 reply, 1 thread resolved on GitHub, 2 comments need you first, with Cancel and Push buttons">
</picture>

Finish a review in one action. There is one **Push**, in the Branch header, and no push on a single comment (a reply with no change is the exception, below): **Push 1** opens a preview right under the header: **Push 1 to hl/fix-duplicate-credit?**, with the count of fixes, replies and threads it will resolve on GitHub, and a note when comments still need you. **Push** pushes the fixes, posts the replies and resolves the threads (on a GitLab merge request too, not on Bitbucket). **Cancel** leaves everything as it was. After an interruption Goodboy looks for your reply in the thread before posting it again.

A reply-only answer is never left waiting on a push that will not come. When you accept one and no accepted fix is waiting to push, it is posted on the spot as a reply in the thread: the note reads **Posting the reply**, then **Replied on GitHub** with **View comment**. If a fix is waiting, the note says **Reply only. It goes out with the next push.** with **Post reply now** beside it. A reply that could not be posted shows its reason in the comment with **Retry**. When the pull request refreshes and a reply you wrote yourself on GitHub says the same as the draft, the comment reads **Replied on GitHub** and Goodboy does not post it twice.

You steer the answer in the thread, no dialog. On an answer with no change, **Fix it anyway** starts a fix for that comment, with a field for an optional hint. On a fix that is ready, **Reply only** drops the change for that comment and keeps its reply to edit. On any reply, **Rewrite reply** opens a field for a hint and asks the agent for a new reply with no code change, and **Edit reply** lets you change the text by hand before it goes out.

### Review replies in your voice

Get replies that sound like you, **Terse**, **Friendly**, **Formal** or **Your replies**. **Your replies** reads your last 20 review replies and writes a style note you can edit. When you squash or fold a fix, the reply names both commits, and a reply already posted gets an Update line, which you can turn off in Settings.

### Fixes on a branch that moved

Accept a fix even after the branch got new commits: it lands on top of the latest one, and on a conflict the branch goes back to its old head.

### Squash and fold the resolve commits

Tidy the fixes before anyone sees them, on the **Commits** tab of the Branch page. It lists the commits since the base, yours and the resolve commits, and opens the history rewriter on them: fold a fix into the commit it belonged to, squash it with the one above, reword it or drop it. **Backups** restores the branch to how it was before a rewrite. A rewrite is tried in a copy first and a backup is kept. When commits are already on origin it says first that this is a force push with lease that reviewers will see as force-pushed. **Undo rewrite** restores the backup and puts every comment back on its commit.

### Notes before a pull request

Review your own diff before anyone else does. The Files tab lists the changed files as a tree beside the code, folders first, with a ring on each folder that fills as you mark its files **Viewed**, and **Comment on file** for a note on a whole file. Leave notes on lines with **Add note** in the Files tab, resolve them like review comments in the Comments tab, where they read **Local**, and move the open ones into a review draft with **Post open notes to the PR**. A note belongs to a branch: it is stored with its project and branch and shows only there. Notes with no branch wait in **Unassigned notes** on the Session overview, in full, each with **Move to** a branch (you pick one when the session has several) and **Discard**. **Discard** removes the note at once, with no confirmation: the toast **Note discarded** offers **Undo**, and ⌘Z brings back the same note. With two or more, **Discard all** does the same for the whole list.

### Pull request on the Branch page

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-light.webp" alt="Pull request #318, Stop retried webhooks posting a second credit, marked In review with a Squash and merge button, 9 comments to resolve, Changes on this branch +47 -12, Review Approved, Checks 3 of 3 passing and the typecheck, unit tests and lint checks">
</picture>

Know whether a GitHub pull request can merge, in plain words, with its checks, and merge, mark ready, draft or close it from the Branch header. The header shows the title, the state, **head → base** and the checks, and its one primary is the next step, such as **Ready for review** on a draft, **Push N**, **Create PR** or **Merge**. **Merge** and **Close** confirm right under the header. The **Checks** tab lists the CI runs with the failing step, and **Fix failing check** starts an agent on it.

### One trail to the Branch page

Reach a branch from any door and land on the same place. The palette, a notification, a chat card and the board all open the Branch page with the same trail, such as **Session**, **Branch**, **Comments**. **Up** is the crumb on the left and **Back** walks your history. There is no separate pull request, Diff or Review page.

### Write it

Get a pull request title, description and changelog entry in your repo's format when you open a pull request. Goodboy then pushes the branch and opens the pull request with that text. If a step fails, the reason shows where you clicked, next to **Retry**, and the text is kept on the Scribe's page under **Pull request text**. Linked issues become closing references.

### PR description follows the push

Keep a pull request description in step with its branch. After a history push, a description Goodboy wrote is updated to match, unless you edited it.

### Read the code

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-light.webp" alt="The changes of payments-api on hl/fix-duplicate-credit, branch vs main with 3 files +47 -12, 1 of 3 viewed, Unified and Split, and an open note under line 26 of applyWebhook.ts, 1 note">
</picture>

Read the branch against its base on the **Files** tab, with syntax colors, word-level highlights, a **Unified** or **Split** view (under **Display**; Split needs room for two columns of code, so a narrow window shows Unified and says **Split needs a wider window** until there is room) and a **Viewed** tick per file (**1 of 3 viewed** here), and quote a line into a note or a question for an agent. A note shows under its line with **Close note** and **Delete**; fixing it happens in the Comments tab. A note stays on its branch: it never reaches a running agent by itself and never counts as the answer to one of its questions. To put lines in front of an agent now, write in the note box and choose **Ask agent** instead of **Add note**: the agent's conversation opens in a drawer on the right with the lines in its message box, with their file and line numbers, quoted, and your text under them; the diff stays where it was, and nothing is saved as a note. A note box opens right under the line you clicked, across both halves in Split, and Esc or saving puts you back on that line number. The tab has no Fix and no Push: the Branch header offers the next step for the branch, such as **Rebase on main**, **Push N** or **Create PR**. One line above the code says what you compare, such as **Comparing main ← hl/fix-duplicate-credit · All 3 commits**, and **Display** holds **Unified**, **Split** and **Wrap long lines**. A file tree on the left lists the changed files by folder with their counts, a ring on each folder that fills as you mark its files **Viewed**, a check on the ones you viewed and a dot on the ones that changed since. A click jumps to the file in one continuous diff. Type in the filter above the tree to narrow the files, turn on **Unviewed** or **With notes**, or group the tree by kind. Generated files, such as lockfiles, wait in a closed **Generated** row at the bottom. **Comment on file** on a file header, or on its row in the tree, leaves a comment on the whole file: a review draft when the branch has a pull request, a note otherwise. Keys: **J** and **K** (or **[** and **]**) move between files, **H** and **L** close and open the folder, **V** marks the file viewed and goes to the next one, **N** goes to the next unviewed file, **F** focuses the tree, **/** or **T** the filter, and **⌘⇧B** shows or hides the tree. A big change keeps the tree light, and on a narrow window the tree folds to a thin strip with the progress ring.

### Write review

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-light.webp" alt="The Write review form under a diff: Line comments 1 for src/webhooks/applyWebhook.ts:26, a Verdict of Comment, Approve or Request changes, an optional Summary, and a Submit comments button" width="800">
</picture>

Review someone else's pull request from the diff, opened with **Write review** on the Files tab: click a line number to leave a line comment right under it, then press **Review** in the diff toolbar (it counts your line comments) for a panel that hangs under it. The panel lists your **Line comments**, a **Verdict** (**Comment**, **Approve** or **Request changes**) and an optional **Summary**. The button at its end reads **Submit comments**, **Approve** or **Request changes** to match the verdict, and GitHub shows it as one review. Outdated drafts are marked **Stale**.

**Also in this area**

| Feature            | What it does for you                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Written by Goodboy | Comments Goodboy posts end with a line that says so, and a setting turns it off          |
| Resolve again      | Rereads a comment and tries the fix once more                                            |
| Checks             | The pull request's checks with durations, and a failed one becomes a **Next** suggestion |
