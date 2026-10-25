# Your first task

Go from install to a merged pull request in one session. The steps use Harborline, a team with three repositories: payments-api, ledger-core and notify-relay.

### 1. Install and open a folder

[Install Goodboy](../README.md#install) and open it. Setup first checks the agents on your computer, and one signed-in agent is enough. On the Workspace step, drop the payments-api folder or press **Choose folder** (⌘O), then press **Create**. Nothing is saved before **Create**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-workspace-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-workspace-light.webp" alt="The Workspace step of setup with a drop area for a folder">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### 2. Write the ask

Press ⌘K and choose **Start a run**. On the New session page, write the goal in your own words, such as "Stop retried webhooks posting a second credit". Press **Start**. Goodboy picks how to run it and keeps the reason with the run.

### 3. Watch it on the board

The Sessions page shows every session in lanes: **Building**, **Running**, **Needs you**, **In review**, **Done** and **Archived**. Your session sits in the lane that matches what is happening in it. When an agent needs an answer or an OK, the card moves to **Needs you** and says why. Press ⌥⌘↓ to jump to the next session that needs you.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with its sessions in six lanes, from Building to Archived">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### 4. Review in place

When the work is ready, Next in the session offers **Open a pull request for hl/fix-duplicate-credit**. Open the branch under **Projects** to reach the Branch page. Read the diff in **Files**. Check the review comments you want fixed and press **Fix**. An agent works in its own copy of the branch, and you accept, edit or skip each result.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-light.webp" alt="The Comments tab of the Branch page for pull request 318 with its comments grouped by state">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### 5. Merge from the session

Press **Push** in the Branch header. A short confirm counts the fixes, replies and threads it will send, and one **Push** sends them. The **Merge** cell on the Pull request page says what still blocks the merge, such as **Blocked by checks**. When nothing blocks it, press **Merge** in the same header. Next then offers to remove the payments-api worktree.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-light.webp" alt="The Branch header with Push and Merge, and a confirm that counts the fixes and replies to send">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Next

- [Set up](features/setup.md): agents, workspaces and your tools
- [Start a task](features/start.md): how Goodboy picks what runs
- [The board](features/board.md): lanes, cards and the list view
- [Review and resolve](features/review.md): the Branch page in full
- [Workflows](features/workflows.md): steps with their own role, model and effort
- [Fix a failing check from the board](walkthroughs/fix-a-failing-check.md)
- [Comment on a plan, then run it](walkthroughs/comment-on-a-plan.md)
- [Review a pull request with comments in place](walkthroughs/review-with-comments.md)
