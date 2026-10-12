# Review and resolve on the Branch page

The Branch page holds one branch: its pull request, review comments, changed files, commits and checks. Use it to read your own diff, let an agent turn review comments into commits and send everything back with one push. It works the same on GitHub, GitLab and Bitbucket.

### Resolve

Turn review comments into commits without writing the fixes yourself. Check the comments you want and press **Fix**: one agent works through them in its own copy of the branch and ends each one with a fix, a reply or a question. You accept, edit or skip each result, and nothing leaves your machine until you push.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-light.webp" alt="The Comments tab of the Branch page for hl/fix-duplicate-credit, between the tabs Pull request, Comments 9, Files, Commits and Checks, under a strip that reads Fixing 4 comments, 3 need you, 1 working. The list groups the comments as Needs you 4, Working 1, Ready to push 1, Open 1, Done and Left open on GitHub, and the question from omar-t on errorShape.ts:9 is open on the right with the question from the fix run, Answer and Skip">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Bulk actions

Handle many comments at once. **Fix comments** checks every open comment, **Use the recommended answers** answers the agent's open questions in one go, and **Accept** takes every waiting fix, with **Undo** right after.

### Review sources

Read pull request comments and your own notes in one list in the Comments section. Each row says where it comes from: **Note**, **On GitHub**, **On GitLab** or **On Bitbucket**. Reading and replying work on every host, and a Bitbucket thread stays open because Bitbucket cannot resolve it.

### Comment states

See what each comment needs next. The list groups comments under **Needs you**, **Working**, **Ready to push**, **Done** and **Left open**, and each comment names its state, such as **Question**, **To review** or **Couldn't fix**. If the reviewer edits a comment after the agent drafted an answer, you choose to redraft or keep the draft.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-light.webp" width="412" alt="The comment list of the Branch page with the groups Needs you 5 with Accept 2, Working 1, Ready to push 1 with Push 1 and Open 1, then Done 1 and Left open on GitHub 1 folded, each row marked Question, Push failed, To review, Working, Ready or Open">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Failed drafts

When a fix fails, the comment says why in one sentence and links to the agent's transcript. Retry it in the same run, start over with a new agent, try another model or add a hint.

### See what a resolve did

Open a fix run from Activity or from a comment to see what the agent did. A drawer beside the list shows its commits, the comments it touched and the whole conversation, and you can write to the agent from there.

### Fixes already on the branch

Goodboy checks origin before it pushes. A comment already fixed by a commit you pushed, or by a teammate's commit, offers **Reply and resolve** instead of a new fix.

### A fix that went missing

If a fix commit is no longer on the branch, for example after a squash done elsewhere, the comment reads **Fix went missing**. Goodboy asks git first, then can ask a read-only agent whether the fix is still needed. Nothing is closed or fixed without you.

### Close on GitHub

Finish a review with the one **Push** in the Branch header. A preview counts the fixes, replies and threads to resolve, then **Push** sends them to GitHub or GitLab. A reply with no code change goes out right away when no fix is waiting.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-light.webp" alt="The header of the Branch page for PR #318 with its summary line, and under it a confirm: Push 1 to hl/fix-duplicate-credit, 1 fix in 1 new commit, 1 reply, 1 thread resolved on GitHub, 2 comments need you first, with Cancel and Push buttons">
</picture>

<sub>Screenshot from Goodboy 0.14.0</sub>

### Review replies in your voice

Choose the tone of the replies the agent drafts: **Terse**, **Friendly**, **Formal** or **Your replies**, which learns from your last 20 review replies. You can edit the style note it writes.

### Fixes on a branch that moved

Accept a fix even after the branch got new commits. It lands on top of the latest one, and on a conflict the branch goes back to its old head.

### Squash and fold the resolve commits

Tidy the fix commits before reviewers see them, in the **Commits** section. Fold a fix into the commit it belongs to, squash, reword or drop it, with a backup kept. **Undo rewrite** restores the branch and puts every comment back on its commit.

### Notes before a pull request

Review your own diff before anyone else does. Leave notes on lines or whole files in the **Files** section, where each file header has icons to comment, open in your editor, copy the path and show the whole file in a drawer. Then hand the open ones to an agent with **Fix comments** or move one into your GitHub review with **Post to GitHub**. Notes stay on their branch, and notes with no branch wait on the Session overview.

### Pull request on the Branch page

The **Overview** section is the pull request. Rename it, edit the description, ask for reviewers and read in plain words whether it can merge, such as **Ready to merge** or **Blocked: 2 checks failing**. **Merge** offers only the ways the host allows, and on GitLab the page uses GitLab's words, such as **MR !42**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-light.webp" alt="The Pull request tab of the Branch page for hl/fix-duplicate-credit, between the tabs Pull request, Comments 0, Files 6, Commits 5 and Checks, with the description and its Edit button, the Activity list of pushes, reviews and checks, and a side panel with Status Open, Blocked: 1 check failing, Resolves, Reviewers, Checks, Branch with Rebase on main, and Files changed">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### One trail to the Branch page

Every way into a branch, from the palette, a notification, a chat card or the board, opens the same Branch page with the same trail. **Up** goes to the crumb on the left and **Back** walks your history.

### Write it

Get a pull request title, description and changelog entry in your repo's format, then Goodboy pushes the branch and opens the pull request. Linked issues become closing references. If a step fails, the reason shows next to **Retry** and the text is kept.

### PR description follows the push

A description Goodboy wrote is updated after a history push, so it keeps matching the branch. A description you edited yourself is left alone.

### Read the code

Read the branch against its base in the **Files** section, unified or split, with a file tree that tracks what you marked **Viewed**. Quote lines into a note, or choose **Ask agent** to send them to an agent with your question. The Branch header offers the next step, such as **Push**, **Mark ready for review** or **Merge**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-light.webp" alt="The Files tab of the Branch page with a diff of ledgerClient.ts and postCredit.ts, the Notes 3 button in the toolbar, and the Your notes drawer open on the right: 3 open notes grouped by file, an open note with Fix, Close and Delete, a note To review with Accept, Skip and Close the note, and Fix 2 at the top">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Write review

Review someone else's pull request from its diff. Click a line number to leave a comment, then press **Review** to choose **Comment**, **Approve** or **Request changes** and add a summary. GitHub receives it as one review.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-light.webp" alt="The Write review form under a diff: Line comments 1 for src/webhooks/applyWebhook.ts:26, a Verdict of Comment, Approve or Request changes, an optional Summary, and a Submit comments button" width="800">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

**Also in this area**

| Feature            | What it does for you                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Written by Goodboy | Comments Goodboy posts end with a line that says so, and a setting turns it off                                     |
| Resolve again      | Rereads a comment and tries the fix once more                                                                       |
| Checks             | Lists CI checks with their durations, and **Analyze** asks an agent why one failed and proposes a fix you can start |
