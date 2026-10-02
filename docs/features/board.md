# The board

The board shows every session of a workspace by stage. Workflows chain agents into one run you can steer.

### Stage board

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with 11 sessions in four columns: building 3, running 2, needs you 2 and in review 2, with the New session button and the Done and Archived icons at the right">
</picture>

See where each task stands without moving cards around. Each session sits in **building**, **running**, **needs you** or **in review** based on what is happening in it. Finished sessions fold into the icons at the right edge.

### Session card

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-light.webp" alt="Two session cards: Fix the rounding drift in the settlement export with 1 open question, and Stop retried webhooks posting a second credit with PR #318 awaiting review, each with project and issue chips, cost and age" width="692">
</picture>

Read a task at a glance: the pull request or status line, the agent count, project and issue chips, cost and age. A colored bar on the left shows the stage. When one action is waiting, a round button opens it, like **1 open question** on the first card.

### Done and Archived dock

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-dock-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-dock-light.webp" alt="The needs you and in review columns with the dock widened on hover, showing Done 2 and Archived 2" width="732">
</picture>

Keep finished work out of the way but close by. Done and archived sessions fold into two icons at the side of the board. Hover them to read **Done** and **Archived** with their counts, and click one to open its column.

### Bulk select

Tidy many sessions at once. Lasso or modifier-click cards across columns, then use **Archive**, **Restore** or **Delete** on the selection together.
