# Review, resolve and pull requests

Turn review comments into commits, push them back to GitHub, and read your own pull requests and diffs before anyone else does.

### Resolve

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-light.webp" alt="Review for PR #318 in Harborline under the Comments and Commits switch, with six open comments on the left and the one from kenji-w on retryPolicy.ts:42 on the right, marked Ready, with a Proposed change that caps the retries in retryPolicy.ts and metrics.ts">
</picture>

Turn review comments into commits without writing the fix yourself. Review lists the comments on the left and the one you picked on the right. Press **Fix** on a comment (or **F**), pick the model and commit style in the strip that opens under the header, and each comment gets its own agent (check several comments with the box that shows on hover, **X** or **Cmd+A**, then **Fix N separately** to start them together), working in its own copy of the branch, up to four at a time while the rest wait for a free slot. Each agent writes its fix as a commit and drafts the reply, then you accept it, edit it, reply yourself or skip the comment. Accepting puts the fix on your branch; if it collides with a fix you accepted before, the branch stays as it was and the comment says to redo it on top. A retry keeps the model, commit style and hint the comment started with.

### Review sources

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-sources-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-sources-light.webp" width="520" alt="The Review header of notify-relay !57 with the source picker open: payments-api #318 on GitHub with 9 open, notify-relay !57 on GitLab with 3 open and checked, and Notes on this machine with 2 open">
</picture>

Read the comments of every request in the session from one place. The picker under the Review title lists each pull request and merge request of the session with its provider icon and open count, and **Notes on this machine** last. A session with two projects on two providers shows two entries, and picking one makes its project the active one. Draft, reply and push work the same everywhere. Where a provider cannot resolve a thread, the comment offers **Reply** and no resolve, and the push confirm says the thread stays open for the reviewer.

| Source                 | Read comments   | Reply | Resolve thread            |
| ---------------------- | --------------- | ----- | ------------------------- |
| GitHub pull request    | Yes             | Yes   | Yes                       |
| GitLab merge request   | Yes             | Yes   | Yes                       |
| Bitbucket pull request | Inline comments | Yes   | No, the thread stays open |
| Notes on this machine  | Yes             | No    | Close the note            |

### Comment states

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-light.webp" width="420" alt="The comment list of Review for PR #318 under the summary 6 open, 1 drafting, 1 ready to push, 2 done and the Comments and Commits switch, with a filter menu and the groups Open 6, Ready to push 1 and Done 2, each row marked Comment changed, Needs you, Drafting, Ready, Not started, Accepted, Skipped or Pushed">
</picture>

Know what each comment needs next. Each one shows a state like **Not started**, **Drafting**, **Needs you**, **Ready** or **Comment changed**, grouped as **Open**, **Ready to push** and **Done**. A single summary line under the title counts them, and the list menu filters by state. A comment is marked changed only when the reviewer really edited the original comment after the draft (a new reply shows as **New reply from** the author and never blocks Accept): the card shows the text before and after and who wrote it, and you choose **Redraft with the new comment** or **Keep the draft**. A comment whose line moved on GitHub says so, and stays as it is.

### Failed drafts

Know why a draft failed and what to do next. The comment says why in plain words, shows the last command the agent ran and how it ended, and links to the transcript. Pick **Try again**, **Try another model** or **Add a hint**, and earlier attempts fold into one line above. When a push fails because the branch on origin moved, **Sync and try again** asks first, brings the new commits under yours, and stops without touching anything if they conflict.

### Manage a resolve from its Brief

Click a resolve in Activity and its Brief holds the comment, the fix and the reply, with **Accept**, **Edit**, **Reply** and **Skip**. The header chip reads the comment state, as Activity does, such as **Ready for you** or **Accepted**, not **Done**. After you accept, **Push now** pushes exactly that fix, after a confirm right under the header. If earlier local commits would go with it, the confirm lists them first. A resolve that fixed several comments together shows **Open in Review (N)** instead, and Review opens on the first of them.

### Fixes already on the branch

Review looks at origin before it pushes. A comment whose fix you already pushed reads **Already on origin**, and one that someone else's commit seems to have fixed reads **Looks fixed** with the commit and its author. Both offer **Reply and resolve** and never push. If you already answered a thread yourself it reads **You replied** and offers **Resolve only**. On a Bitbucket pull request, where a thread cannot be resolved, the same moves read **Reply** and **Post this reply**, and there is no **Resolve only**.

### A fix that went missing

When the commit of a fix is no longer on the branch or on origin, the comment reads **Fix went missing** with its own detail, and the push blocker points to it. Goodboy first asks git without an agent: the same patch under another sha turns it into **Folded in**: it stays in the push (**Push to reply**) and its reply, "Fixed in the old sha, squashed into the new one", goes out after the push lands. If that is not enough, **Re-check** starts a read-only agent on the cheapest model of your provider. It answers **Already fixed here** (Reply and resolve with the sha), **No longer relevant** (Close with this reply, editable) or **Still needed** (Fix again, Add a hint). A verdict never closes or fixes anything by itself. A pushed fix that origin lost later, after a force push or a squash done elsewhere, gets the same check.

### Close on GitHub

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-light.webp" alt="The Review header of PR #318 with its summary line and the Comments and Commits switch, and under it a confirm: Push 1 to hl/fix-duplicate-credit, 1 fix in 1 new commit, 1 reply, 1 thread resolved on GitHub, 2 comments need you first, with Cancel and Push buttons">
</picture>

Finish a review in one action. **Push 1** in the Review header opens a confirm right under it: **Push 1 to hl/fix-duplicate-credit?**, with the count of fixes, replies and threads it will resolve on GitHub, and a note when comments still need you. **Push** pushes the fixes, posts the replies and resolves the threads (on a GitLab merge request too, not on Bitbucket). **Cancel** leaves everything as it was. After an interruption Goodboy looks for your reply in the thread before posting it again.

### Review replies in your voice

Get replies that sound like you, **Terse**, **Friendly**, **Formal** or **Your replies**. **Your replies** reads your last 20 review replies and writes a style note you can edit. When you squash or fold a fix, the reply names both commits, and a reply already posted gets an Update line, which you can turn off in Settings.

### Fixes on a branch that moved

Accept a fix even after the branch got new commits: it lands on top of the latest one, and on a conflict the branch goes back to its old head.

### Squash and fold the resolve commits

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-commits-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-commits-light.webp" alt="The Commits view of Review for PR #318: the branch hl/fix-duplicate-credit with 5 commits oldest first, the presets Keep as they are, Fold each into its original and One commit for the review, each commit with its sha and whether it is on origin, and on the right the After list of 5 commits with Reset and Rewrite">
</picture>

Choose how the fixes land before anyone sees them. Review has two views, **Comments** and **Commits** (press **V** to switch). **Commits** lists the branch commits since the base, yours and the resolve commits linked to their comment, with three presets: **Keep as they are**, **Fold each into its original** (into the commit the fix was a fixup of) and **One commit for the review**, plus a menu per commit to keep it, fold it into an earlier commit, squash it with the one above or reword it. The preview shows the resulting commits and the predicted outcome before anything runs, and a **Replies** list with the text each comment's reply will carry once the shas move (a reply already posted gets its Update line, with the **Edit the posted reply** switch beside it). A plan you left in Rewrite history is never overwritten: Commits says so and waits for **Open it** or **Replace it**. **Rewrite** goes through Rewrite history: tried in a copy, a backup kept, and when commits are already on origin it says first that this is a force push with lease that reviewers will see as force-pushed. **Undo** restores the backup and puts every comment back on its commit. The preset you pick is remembered per project and sets whether later resolves commit as fixups or new commits.

### Notes before a pull request

Review your own diff before anyone else does. Leave notes on lines, resolve them like review comments, and post the open ones to the pull request later.

### GitHub pull request page

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-light.webp" alt="The page of pull request #318, Stop retried webhooks posting a second credit, marked In review with a Squash and merge button, 9 comments to resolve with Open Review, Changes on this branch +47 -12 with Open diff, Review Approved, Checks 3 of 3 passing and the typecheck, unit tests and lint checks">
</picture>

Know whether a GitHub pull request can merge, in plain words, with details and checks, and merge, mark ready, draft or close it from there. The page shows **Status**, **Review**, **Branch** and **Checks** (**3 of 3 passing**), then the title, description, reviewers and each check. The next step is the one main action, such as **Mark ready for review** on a draft or **Squash and merge** once it is approved and green. **Merge** and **Close** confirm right under the header, and **9 comments to resolve** opens Review with **Open Review**.

### Pull request, Diff and Review as layers

Move between a pull request, its Diff and its Review without losing your place. They open as one path in the trail from the worktree row, such as **Overview**, **Pull request**, **#318** at the top of the page above, and Back walks it. Every link to a pull request lands on its page.

### Write it

Get a pull request title, description and changelog entry in your repo's format when you open a pull request. Linked issues become closing references.

### PR description follows the push

Keep a pull request description in step with its branch. After a history push, a description Goodboy wrote is updated to match, unless you edited it.

### Diff

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-light.webp" alt="The Diff of payments-api on hl/fix-duplicate-credit, branch vs main with 3 files +47 -12, 1 of 3 viewed, Unified and Split, an open note under line 26 of applyWebhook.ts, 1 note, and Resolve in Review and Rewrite history buttons">
</picture>

Read changes with syntax colors, word-level highlights, a **Unified** or **Split** view and a **Viewed** tick per file (**1 of 3 viewed** here), and quote a line into a note or a question for an agent. A note shows under its line with **Fix**, **Close note** and **Delete**. **Fix 2 notes** in the toolbar opens a strip with the model, the commit style and a hint, and **Start** gives each note its own agent and opens a summary of your notes grouped by state. **Open in Review** carries the notes into Review, even when a pull request is open. The header offers the next step for the branch, such as **Rebase on main**, **Push N commits** or **Create PR**, next to **Rewrite history**.

### Write review

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-light.webp" alt="The Write review form under a diff: Line comments 1 for src/webhooks/applyWebhook.ts:26, a Verdict of Comment, Approve or Request changes, an optional Summary, and a Submit comments button" width="800">
</picture>

Review someone else's pull request in a form under the diff, opened with **Write review** on its pull request page. It lists your **Line comments**, a **Verdict** (**Comment**, **Approve** or **Request changes**) and an optional **Summary**. The button under it reads **Submit comments**, **Approve** or **Request changes** to match the verdict, and GitHub shows it as one review. Outdated drafts are marked **Stale**.

**Also in this area**

| Feature            | What it does for you                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Written by Goodboy | Comments Goodboy posts end with a line that says so, and a setting turns it off          |
| Resolve again      | Rereads a comment and tries the fix once more                                            |
| Checks             | The pull request's checks with durations, and a failed one becomes a **Next** suggestion |
