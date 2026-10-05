# Review and resolve on the Branch page

One Branch page per branch holds the Comments, Files, Commits and Checks tabs. Turn review comments into commits with a Fix run, push them back with one Push, and read your own diff and notes before anyone else does.

### Resolve

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-light.webp" alt="The Comments tab of the Branch page for PR #318 in Harborline, with six open comments on the left and the one from kenji-w on retryPolicy.ts:42 on the right, marked Ready, with a Proposed change that caps the retries in retryPolicy.ts and metrics.ts">
</picture>

Turn review comments into commits without writing the fix yourself. The Comments tab lists the comments on the left and the one you picked on the right. Press **Fix** on a comment (or **F**), pick the model and commit style in the strip that opens under the header, and each comment gets its own agent (check several comments with the box that shows on hover, **X** or **Cmd+A**, then **Fix N separately** to start them together), working in its own copy of the branch, up to four at a time while the rest wait for a free slot. Each agent writes its fix as a commit and drafts the reply, then you accept it, edit it, reply yourself or skip the comment. Accepting puts the fix on your branch; if it collides with a fix you accepted before, the branch stays as it was and the comment says to redo it on top. A retry keeps the model, commit style and hint the comment started with.

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

Know what each comment needs next. Each one shows a state like **Not started**, **Drafting**, **Needs you**, **Ready** or **Comment changed**, grouped as **Open**, **Ready to push** and **Done**. A comment is marked changed only when the reviewer really edited the original comment after the draft (a new reply shows as **New reply from** the author and never blocks Accept): the card shows the text before and after and who wrote it, and you choose **Redraft with the new comment** or **Keep the draft**. A comment whose line moved on GitHub says so, and stays as it is.

### Failed drafts

Know why a draft failed and what to do next. The comment says why in plain words, shows the last command the agent ran and how it ended, and links to the transcript. Pick **Retry**, **Try another model** or **Add a hint**, and earlier attempts fold into one line above. When a push fails because the branch on origin moved, the result under the header offers **Sync and try again**, which asks first, brings the new commits under yours, and stops without touching anything if they conflict.

### See what a resolve did

Click a resolve in Activity and it opens as a read-only **Fix run**, a child of its comment on the Branch page. It shows what the resolver did, the commits it made and the comments it touched, each a link to that comment. The header chip reads the comment state, as Activity does, such as **Ready for you** or **Accepted**, not **Done**. **Open transcript** shows the whole conversation. Accept, reply and push stay in the comment on the **Comments** tab, where **Push** names the commits that would go with a fix. A resolve that fixed several comments together says so, and **Open them in Comments** shows just those. A row in Activity that groups several resolves has **Open comments** for the same list.

### Fixes already on the branch

The Branch page looks at origin before it pushes. A comment whose fix you already pushed reads **Already on origin**, and one that someone else's commit seems to have fixed reads **Looks fixed** with the commit and its author. Both offer **Reply and resolve** and never push. If you already answered a thread yourself it reads **You replied** and offers **Resolve only**. On a Bitbucket pull request, where a thread cannot be resolved, the same moves read **Reply** and **Post this reply**, and there is no **Resolve only**.

### A fix that went missing

When the commit of a fix is no longer on the branch or on origin, the comment reads **Fix went missing** with its own detail, and the push blocker points to it. Goodboy first asks git without an agent: the same patch under another sha turns it into **Folded in**: it stays in the push (the header **Push**) and its reply, "Fixed in the old sha, squashed into the new one", goes out after the push lands. If that is not enough, **Re-check** starts a read-only agent on the cheapest model of your provider. It answers **Already fixed here** (Reply and resolve with the sha), **No longer relevant** (Close with this reply, editable) or **Still needed** (Fix again, Add a hint). A verdict never closes or fixes anything by itself. A pushed fix that origin lost later, after a force push or a squash done elsewhere, gets the same check.

### Close on GitHub

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-light.webp" alt="The header of the Branch page for PR #318 with its summary line, and under it a confirm: Push 1 to hl/fix-duplicate-credit, 1 fix in 1 new commit, 1 reply, 1 thread resolved on GitHub, 2 comments need you first, with Cancel and Push buttons">
</picture>

Finish a review in one action. There is one **Push**, in the Branch header, and no push on a single comment: **Push 1** opens a preview right under the header: **Push 1 to hl/fix-duplicate-credit?**, with the count of fixes, replies and threads it will resolve on GitHub, and a note when comments still need you. **Push** pushes the fixes, posts the replies and resolves the threads (on a GitLab merge request too, not on Bitbucket). **Cancel** leaves everything as it was. After an interruption Goodboy looks for your reply in the thread before posting it again.

### Review replies in your voice

Get replies that sound like you, **Terse**, **Friendly**, **Formal** or **Your replies**. **Your replies** reads your last 20 review replies and writes a style note you can edit. When you squash or fold a fix, the reply names both commits, and a reply already posted gets an Update line, which you can turn off in Settings.

### Fixes on a branch that moved

Accept a fix even after the branch got new commits: it lands on top of the latest one, and on a conflict the branch goes back to its old head.

### Squash and fold the resolve commits

Tidy the fixes before anyone sees them, on the **Commits** tab of the Branch page. It lists the commits since the base, yours and the resolve commits, and opens the history rewriter on them: fold a fix into the commit it belonged to, squash it with the one above, reword it or drop it. **Backups** restores the branch to how it was before a rewrite. A rewrite is tried in a copy first and a backup is kept. When commits are already on origin it says first that this is a force push with lease that reviewers will see as force-pushed. **Undo rewrite** restores the backup and puts every comment back on its commit.

### Notes before a pull request

Review your own diff before anyone else does. Leave notes on lines with **Add note** in the Files tab, resolve them like review comments in the Comments tab, where they read **Local**, and move the open ones into a review draft with **Post open notes to the PR**. A note belongs to a branch: it is stored with its project and branch and shows only there. Notes with no branch wait in **Unassigned notes** on the Session overview, in full, each with **Move to** the branch you are on.

### Pull request on the Branch page

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-light.webp" alt="Pull request #318, Stop retried webhooks posting a second credit, marked In review with a Squash and merge button, 9 comments to resolve, Changes on this branch +47 -12, Review Approved, Checks 3 of 3 passing and the typecheck, unit tests and lint checks">
</picture>

Know whether a GitHub pull request can merge, in plain words, with its checks, and merge, mark ready, draft or close it from the Branch header. The header shows the title, the state, **head → base** and the checks, and its one primary is the next step, such as **Ready for review** on a draft, **Push N**, **Create PR** or **Merge**. **Merge** and **Close** confirm right under the header. The **Checks** tab lists the CI runs with the failing step, and **Fix failing check** starts an agent on it.

### One trail to the Branch page

Reach a branch from any door and land on the same place. The palette, a notification, a chat card and the board all open the Branch page with the same trail, such as **Session**, **Branch**, **Comments**. **Up** is the crumb on the left and **Back** walks your history. There is no separate pull request, Diff or Review page.

### Write it

Get a pull request title, description and changelog entry in your repo's format when you open a pull request. Linked issues become closing references.

### PR description follows the push

Keep a pull request description in step with its branch. After a history push, a description Goodboy wrote is updated to match, unless you edited it.

### Read the code

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-light.webp" alt="The changes of payments-api on hl/fix-duplicate-credit, branch vs main with 3 files +47 -12, 1 of 3 viewed, Unified and Split, and an open note under line 26 of applyWebhook.ts, 1 note">
</picture>

Read the branch against its base on the **Files** tab, with syntax colors, word-level highlights, a **Unified** or **Split** view and a **Viewed** tick per file (**1 of 3 viewed** here), and quote a line into a note or a question for an agent. A note shows under its line with **Close note** and **Delete**; fixing it happens in the Comments tab. The tab has no Fix and no Push: the Branch header offers the next step for the branch, such as **Rebase on main**, **Push N** or **Create PR**. A file tree on the left lists the changed files by folder with their counts and a check on the ones you viewed, and a click jumps to the file.

### Write review

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-light.webp" alt="The Write review form under a diff: Line comments 1 for src/webhooks/applyWebhook.ts:26, a Verdict of Comment, Approve or Request changes, an optional Summary, and a Submit comments button" width="800">
</picture>

Review someone else's pull request in a form under the diff, opened with **Write review** on the Files tab. It lists your **Line comments**, a **Verdict** (**Comment**, **Approve** or **Request changes**) and an optional **Summary**. The button under it reads **Submit comments**, **Approve** or **Request changes** to match the verdict, and GitHub shows it as one review. Outdated drafts are marked **Stale**.

**Also in this area**

| Feature            | What it does for you                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Written by Goodboy | Comments Goodboy posts end with a line that says so, and a setting turns it off          |
| Resolve again      | Rereads a comment and tries the fix once more                                            |
| Checks             | The pull request's checks with durations, and a failed one becomes a **Next** suggestion |
