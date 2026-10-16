# The board

The Sessions page shows every session of a workspace, as a board in lanes by stage or as one list, so you see where each task stands and which ones need you. Sessions move between lanes by themselves as their work changes. A **Board** and **List** switch sits in the page header next to the filter, and the choice is kept per workspace.

### Stage board

See where each task stands without moving cards around. Six lanes, **building**, **running**, **needs you**, **in review**, **done** and **archived**, always sit in that order, and each session sits in the lane that matches what is happening in it. A session waiting on your answer sits in **needs you**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with its sessions in six lanes: building, running, needs you, in review, done and archived, with the New session button at the top right">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### List view

Scan every session in one table. Each row holds the state node, the issue key, the title, the project, the same one signal as the card and the time of the last update, in columns that line up from row to row. The list follows the filter's sort and grouping, says how many sessions the filters hide, and a click opens the session. Sessions with no activity for three days close the list in an **Inactive** group, newest first, and their last column reads their age like every other row, such as "4d ago".

### Repository status

See when a repository needs you. One pill in the page header, such as **2 repos need attention**, shows only when a repository is behind, has uncommitted files, has diverged or cannot be read, and opens the repository list with **Update** and each repository's detail. When every repository is fine, the filter holds a **Repositories** line with **Check origin**.

### Done and Archived lanes

Finished work stays in view. **Done** and **archived** are lanes like the others, and **Restore** on an archived card puts the session back where it belongs. On a narrow window the two share the last lane.

### Session card

Read a task at a glance: its title on two lines, its project in gray, and one signal at the right. The signal is the first that applies: an open question, a failed check, the pull request in its state color (click it to open the pull request), or a running dot with the number of agents at work (the number shows from two on). Age, linked issues, agent count, cost, the pin and draft review comments wait in the card that opens when you rest the pointer on it. When one action waits on you, such as an open question, a round button on the card opens it; the rest of the session's verbs are in the card's right-click menu. Cards stay neutral: the lane names the state, so no card carries a colored bar.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-light.webp" alt="Two session cards: Fix the rounding drift in the settlement export with 1 open question, and Stop retried webhooks posting a second credit with PR #318 awaiting review, each with project and issue chips, cost and age" width="692">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Bulk select

Tidy many sessions at once. Tick cards, lasso them or press **⌘A**, then **Archive**, **Restore** or **Delete** them from the bar at the bottom. Archive and Restore can be undone, and Delete asks first.
