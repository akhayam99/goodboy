# The board

The board shows every session of a workspace by stage. Workflows chain agents into one run you can steer.

### Stage board

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with 11 sessions in four columns: building 3, running 2, needs you 2 and in review 2, with the New session button and the Done and Archived icons at the right">
</picture>

See where each task stands without moving cards around. Each session sits in **building**, **running**, **needs you** or **in review** based on what is happening in it. Finished sessions fold into the icons at the right edge. Tasks linked to the whole workspace sit in one quiet row under the title, **Ongoing**: click a task to show only the sessions that link it, click it again or **Clear** to see them all, and its x stops tracking it.

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

Tidy many sessions at once. Tick the checkbox that appears at the top left of a card when you point at it or focus it, above its colored edge and without moving the title, or lasso and modifier-click cards across columns. Once one card is picked, every card shows its checkbox, and one bar floats at the bottom of the board with **Clear**, the count, **Select all** and the verbs: **Archive** or **Restore** run at once and can be undone, **Delete** asks first, above the bar, and says what goes and what stays. **X** picks the card under the pointer, **⌘A** picks every card, **Esc** clears and **Delete** opens the confirmation.
