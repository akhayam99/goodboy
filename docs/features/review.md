# Review and resolve on the Branch page

One Branch page per branch holds the Comments, Files, Commits and Checks tabs. Turn review comments into commits with a Fix run, push them back with one Push, and read your own diff and notes before anyone else does.

### Resolve

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-light.webp" alt="The Comments tab of the Branch page for PR #318 in Harborline, with six open comments on the left and the one from kenji-w on retryPolicy.ts:42 on the right, marked Ready, with a Proposed change that caps the retries in retryPolicy.ts and metrics.ts">
</picture>

Turn review comments into commits without writing the fix yourself.

#### Start a fix run

The Comments tab lists the comments on the left and the one you picked on the right.

- Press **Fix** on a comment (or **F**), or check the ones you want (the box on hover, **X** or **Cmd+A**) and press **Fix N** in the bar at the bottom of the list
- A panel takes the place of the thread, so the page doesn't move: the comments it covers, with a check to drop any, the model with **Change**, and an optional note
- **Start fixing N** begins. **Esc** closes the panel and keeps the comment you had open

#### One agent per branch

One agent works through the comments in order, in its own copy of the branch. A branch never has two agents fixing at once: new comments, a retry, **Fix anyway** or a message to another agent of the branch wait and say **Queued, after the current fix**. Branches still run beside each other.

#### Accept each fix

Each fix is a commit stacked on the one before, so a later fix sees the earlier ones, and the agent drafts the reply. You accept, edit, reply yourself or skip each comment.

Accepting puts the fix on your branch with the fixes before it, in order: the button reads **Accept 3 fixes**. Refusing or taking back a fix in the middle drops it, and the fixes after it are rebuilt on top, with one line saying so.

#### Follow the run

While a run is going, one line under the tabs shows:

- What it's doing: **Fixing 2 of 5 · next: Module name…** or **Waiting for your answer**
- The tally, **5 ready · 1 needs you · 2 working · 1 couldn't fix**, each a filter for the list
- The model, **Sonnet 5.5 · Medium**
- **Open transcript** and **Stop**

The list groups by the five words, **Needs you** first and **Done** closed.

#### Questions from the agent

The agent asks only when a comment reads two ways that lead to different code. The question shows in the thread as **Question from the fix run**, with its options (the recommended one marked), **Or tell it something else** and **Continue the fix run**. It also shows at the top of the transcript drawer.

Answers, retries and messages all go to the same agent, in the same copy. A retry keeps the model, commit style and hint; pick another model and the comment starts over in a new fix run.

### Bulk actions

Fix, answer and accept many comments at once.

- **Fix all.** With no run going, **Fix 9 open comments** under the tabs (or **Cmd+A**) checks every comment you can fix, open or couldn't fix, and opens the launch panel. A comment that needs you stays out, because you answer it instead. **Draft fixes for 9** on the Overview and **Resolve 9 comments** on a Board card open the same panel, and never start a run by themselves
- **Answer all.** With two or more open questions, **Use the recommended answers (2)** opens a panel with each recommended answer chosen. Pick another, or **Drop** one to leave it in Needs you, then **Continue with 2 answers**
- **Retry all.** **Retry 1 that couldn't fix** retries them in the same run and the same copy of the branch
- **Accept all.** **Accept 5** sits next to the Ready group, and **Accept 3** in the bar accepts the checked ones. **Undo** on the **5 accepted** bar, or **Cmd+Z**, puts them back in Ready

Nothing leaves your machine until **Push 5** in the header, the one place that pushes.

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

Know what each comment needs next. The list groups comments by their word, **Needs you** on top and **Done** closed.

- **Open**: not in a fix run yet
- **Working**: how long it has been going, and its last step
- **Needs you**: the agent asks you something
- **Ready**: the change and the reply, with **Accept**, **Edit reply** and **Skip**
- **Couldn't fix**: why, and what to try next
- **Done**

Small notes sit next to the word: what git says, **Checks failed** and **Comment changed**. A comment is marked changed only when the reviewer edited the original after the draft: the card shows the text before and after, and you choose **Redraft with the new comment** or **Keep the draft**. A new reply shows as **New reply from** and never blocks Accept. A comment whose line moved on GitHub says so, and stays as it is.

### Failed drafts

Know why a fix couldn't be made and what to do next.

A run that ends without a result is never a failure: the agent's last message shows as the question, under **Needs you**. A fix that really failed says why in one sentence: it didn't start, the provider stopped it, every provider is over its spend cap, you stopped it, the app closed, it conflicts with a fix you accepted, the worktree is gone, or the fix couldn't be saved. Comments from before 0.20 say the cause wasn't recorded.

It also shows the last command the agent ran and how it ended, with a link to the transcript. Earlier attempts fold into one line above.

- **Retry in this run** continues the same run, in the same copy of the branch, for that comment
- **Start over with a new agent** begins a new run
- **⋯** holds **Try another model** and **Add a hint**

When a push fails because the branch on origin moved, **Sync and try again** asks first, brings the new commits under yours, and stops without touching anything if they conflict.

### See what a resolve did

Click a resolve in Activity, **Open transcript** on the run line or **Agent transcript** on a comment: the fix run opens in a drawer on the right of the **Comments** tab, so the list and the thread stay where they are.

The drawer shows the commits it made and the comments it touched, each a link to that comment, a question it's waiting on, the whole conversation and a field to write to the agent. Accept, reply and push stay in the comment, where **Push** names the commits that go with a fix. A resolve that fixed several comments together says so, and **Open them in Comments** shows just those.

### Fixes already on the branch

The Branch page looks at origin before it pushes.

- **Already on origin**: you already pushed the fix
- **Looks fixed**: someone else's commit seems to fix it, shown with the commit and its author
- **You replied**: you already answered the thread yourself, with **Resolve only**

**Already on origin** and **Looks fixed** offer **Reply and resolve** and never push. On a Bitbucket pull request, where a thread can't be resolved, the same moves read **Reply** and **Post this reply**, and there is no **Resolve only**.

### A fix that went missing

When the commit of a fix is no longer on the branch or on origin, the comment reads **Fix went missing** and the push blocker points to it.

Goodboy first asks git: the same patch under another sha turns it into **Folded in**. It stays in the push, and its reply, "Fixed in the old sha, squashed into the new one", goes out after the push lands. Otherwise **Re-check** asks a read-only agent on your provider's cheapest model for a verdict:

- **Already fixed here**: Reply and resolve with the sha
- **No longer relevant**: Close with this reply, editable
- **Still needed**: Fix again, Add a hint

A verdict never closes or fixes anything by itself. A pushed fix that origin lost later, after a force push or a squash done elsewhere, gets the same check.

### Close on GitHub

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-light.webp" alt="The header of the Branch page for PR #318 with its summary line, and under it a confirm: Push 1 to hl/fix-duplicate-credit, 1 fix in 1 new commit, 1 reply, 1 thread resolved on GitHub, 2 comments need you first, with Cancel and Push buttons">
</picture>

Finish a review in one action.

#### One push

There is one **Push**, in the Branch header, and none on a single comment. **Push 1** opens a preview under the header, **Push 1 to hl/fix-duplicate-credit?**, with the count of fixes, replies and threads it will resolve, and a note when comments still need you.

**Push** pushes the fixes, posts the replies and resolves the threads, on a GitLab merge request too but not on Bitbucket. **Cancel** leaves everything as it was. After an interruption, Goodboy looks for your reply in the thread before posting it again.

#### Replies with no change

A reply-only answer never waits on a push that won't come. Accept one with no fix waiting and it posts at once: **Posting the reply**, then **Replied on GitHub** with **View comment**.

- With a fix waiting, it reads **Reply only. It goes out with the next push.** with **Post reply now**
- A reply that couldn't be posted shows its reason, with **Retry**
- If you already wrote the same reply on GitHub yourself, it reads **Replied on GitHub** and isn't posted twice

#### Steer the answer

Steer it in the thread, with no dialog:

- **Fix it anyway**, on an answer with no change, starts a fix with an optional hint
- **Reply only**, on a ready fix that is still staged, drops the change and keeps the reply. Once the fix is on the branch it isn't offered
- **Rewrite reply** asks the agent for a new reply, with a hint and no code change
- **Edit reply**, on a fix, changes the text by hand before it goes out

A **Retry** on a reply that failed alongside other conversations points to the pull request bar, which checks GitHub before sending it again.

### Review replies in your voice

Get replies that sound like you, **Terse**, **Friendly**, **Formal** or **Your replies**. **Your replies** reads your last 20 review replies and writes a style note you can edit. When you squash or fold a fix, the reply names both commits, and a reply already posted gets an Update line, which you can turn off in Settings.

### Fixes on a branch that moved

Accept a fix even after the branch got new commits: it lands on top of the latest one, and on a conflict the branch goes back to its old head.

### Squash and fold the resolve commits

Tidy the fixes before anyone sees them, on the **Commits** tab of the Branch page. It lists the commits since the base, yours and the resolve commits, and opens the history rewriter on them.

- Fold a fix into the commit it belonged to, squash it with the one above, reword it or drop it
- A rewrite is tried in a copy first, and a backup is kept. **Backups** restores the branch to how it was
- When commits are already on origin, it says first that this is a force push with lease, which reviewers will see
- **Undo rewrite** restores the backup and puts every comment back on its commit

### Notes before a pull request

Review your own diff before anyone else does. Leave notes on lines with **Add note** in the Files tab, or on a whole file with **Comment on file**. Resolve them in the Comments tab, where they read **Local**, and move the open ones into a review draft with **Post open notes to the PR**.

A note belongs to its branch and shows only there. Notes with no branch wait in **Unassigned notes** on the Session overview, each with **Move to** a branch and **Discard**. **Discard** removes a note at once: the toast **Note discarded** offers **Undo**, and ⌘Z brings it back. With two or more, **Discard all** does the same for the whole list.

### Pull request on the Branch page

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-light.webp" alt="Pull request #318, Stop retried webhooks posting a second credit, marked In review with a Squash and merge button, 9 comments to resolve, Changes on this branch +47 -12, Review Approved, Checks 3 of 3 passing and the typecheck, unit tests and lint checks">
</picture>

Know whether a GitHub pull request can merge, in plain words, with its checks, and merge, mark ready, draft or close it from the Branch header.

#### Header

The header shows the title, the state, **head → base** and the checks. Its one primary is the next step, such as **Ready for review** on a draft, **Push N**, **Create PR** or **Merge**. A blocked primary says why in the meta line, such as **1 check still running.** beside a disabled **Merge**. **Merge** and **Close** confirm right under the header.

#### Checks tab

One line sums it up, such as **2 failing · 1 running · 9 passed** (**Reading checks** while it loads). Below it the CI runs are grouped as Failing, Running, Passed and Skipped, each opening its log on GitHub, and **Fix failing check** starts an agent on a failing one.

- **No checks have reported on this pull request yet**, with **View on GitHub**, before any report
- **Checks run once the pull request exists**, with **Create pull request**, on a branch without one
- A GitLab merge request or a Bitbucket pull request says Goodboy doesn't show its checks yet, with a link to the host
- **Couldn't read checks**, with **Retry** and **Details**, on any other failure

If the GitHub access Goodboy uses can't read checks, the tab names the repository and the fix: **Give the token read access to checks and commit statuses** with **Open GitHub settings** for a token bound in Settings, or `gh auth refresh -s repo` to copy for the `gh` login, then **Check again**. Reviewers still show, and **Merge** stays blocked with **Checks unknown**.

### One trail to the Branch page

Reach a branch from any door and land on the same place. The palette, a notification, a chat card and the board all open the Branch page with the same trail, such as **Session**, **Branch**, **Comments**. **Up** is the crumb on the left and **Back** walks your history. Every tab sits on one centred column, so nothing moves when you switch tabs, and a branch chip in the header switches branches or starts a new one. There is no separate pull request, Diff or Review page.

### Write it

Get a pull request title, description and changelog entry in your repo's format when you open a pull request. Goodboy then pushes the branch and opens the pull request with that text. If a step fails, the reason shows where you clicked, next to **Retry**, and the text is kept on the Scribe's page under **Pull request text**. Linked issues become closing references.

### PR description follows the push

Keep a pull request description in step with its branch. After a history push, a description Goodboy wrote is updated to match, unless you edited it.

### Read the code

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-light.webp" alt="The changes of payments-api on hl/fix-duplicate-credit, branch vs main with 3 files +47 -12, 1 of 3 viewed, Unified and Split, and an open note under line 26 of applyWebhook.ts, 1 note">
</picture>

Read the branch against its base on the **Files** tab, with syntax colors, word-level highlights and a **Viewed** tick per file (**1 of 3 viewed** here).

One line above the code says what you compare, such as **Comparing main ← hl/fix-duplicate-credit · All 3 commits**. **Display** holds **Unified**, **Split** and **Wrap long lines**; a window too narrow for two columns shows Unified and says **Split needs a wider window**. The tab has no Fix and no Push: the Branch header offers the next step, such as **Rebase on main**, **Push N** or **Create PR**.

#### File tree

A rail on the left lists the changed files by folder, with their counts. A ring on each folder fills as you mark its files **Viewed**, a check marks the ones you viewed and a dot the ones that changed since. A click jumps to the file in one continuous diff.

- Type in the filter to narrow the files, turn on **Unviewed** or **With notes**, or group the tree by kind
- Generated files, such as lockfiles, wait in a closed **Generated** row at the bottom
- The rail never moves the diff. It stays open on a wide window, rests as a thin strip with the ring on a medium one, and is a **Files 1/6** button on a narrow one. The strip and the button open the tree over the diff, and **Esc** or a click outside closes it

#### Notes and questions

Click a line to quote it into a note or a question for an agent. The box opens right under the line, across both halves in Split, and **Esc** or saving puts you back on that line.

- **Add note** leaves a note under the line, with **Close note** and **Delete**. Fixing it happens in the Comments tab. A note stays on its branch and never reaches an agent by itself
- **Ask agent** opens the agent's conversation in a drawer, with the quoted lines, their file and line numbers, and your text in its message box. The diff stays put, and nothing is saved as a note
- **Comment on file**, on a file header or its row in the tree, comments on the whole file: a review draft when the branch has a pull request, a note otherwise

#### Keys

- **J** and **K** (or **[** and **]**) move between files
- **H** and **L** close and open the folder
- **V** marks the file viewed and goes to the next one
- **N** goes to the next unviewed file
- **F** focuses the tree, **/** or **T** the filter
- **⌘⇧B** folds or opens the tree

### Write review

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-light.webp" alt="The Write review form under a diff: Line comments 1 for src/webhooks/applyWebhook.ts:26, a Verdict of Comment, Approve or Request changes, an optional Summary, and a Submit comments button" width="800">
</picture>

Review someone else's pull request from the diff, with **Write review** on the Files tab.

1. Click a line number to leave a line comment right under it
2. Press **Review** in the diff toolbar, which counts your line comments, to open its panel: your **Line comments**, a **Verdict** (**Comment**, **Approve** or **Request changes**) and an optional **Summary**
3. Press the button at its end, which reads **Submit comments**, **Approve** or **Request changes** to match the verdict. GitHub shows it as one review

Outdated drafts are marked **Stale**.
