# The board

The board shows every session of a workspace in lanes by stage, so you see where each task stands and which ones need you. Sessions move between lanes by themselves as their work changes.

### Stage board

See where each task stands without moving cards around. Six lanes, **building**, **running**, **needs you**, **in review**, **done** and **archived**, always sit in that order, and each session sits in the lane that matches what is happening in it. A session waiting on your answer sits in **needs you**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with its sessions in six lanes: building, running, needs you, in review, done and archived, with the New session button at the top right">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Done and Archived lanes

Finished work stays in view. **Done** and **archived** are lanes like the others, and **Restore** on an archived card puts the session back where it belongs. On a narrow window the two share the last lane.

### Session card

Read a task at a glance: its pull request or status, agents, project, linked issue, cost and age. When one action waits on you, such as an open question, a round button on the card opens it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-light.webp" alt="Two session cards: Fix the rounding drift in the settlement export with 1 open question, and Stop retried webhooks posting a second credit with PR #318 awaiting review, each with project and issue chips, cost and age" width="692">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Bulk select

Tidy many sessions at once. Tick cards, lasso them or press **⌘A**, then **Archive**, **Restore** or **Delete** them from the bar at the bottom. Archive and Restore can be undone, and Delete asks first.
