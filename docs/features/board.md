# The board

The Sessions page shows every session of a workspace, as a board in lanes by stage or as one list, so you see where each task stands and which ones need you. Sessions move between lanes by themselves as their work changes. A **Board** and **List** switch sits in the page header next to the filter, and the choice is kept per workspace.

### Stage board

See where each task stands without moving cards around. Six lanes, **building**, **running**, **needs you**, **in review**, **done** and **archived**, always sit in that order, and each session sits in the lane that matches what is happening in it. A session waiting on your answer sits in **needs you**, and so does one with a run that stopped, paused at its limit or waits for you to continue, an Auto agent that needs your OK, or a Slack reply that waits for your approval. The lane lists the longest wait first, and its tooltip teaches **⌥⌘↓**, the key to the next session that needs you. When nothing needs you the key says so in the top bar for two seconds, and when the open session is the only one it says that instead. The **Sessions** title sits on the same header row, at the same height, as every other page. While the page loads it shows empty lanes on the board and empty rows on the list. With no session yet, **No sessions yet** sits under the title at its left edge. It says a session holds one goal, its agents and, for code, a branch. It draws the five lanes muted with one sentence each. The only **New session** button sits in the first lane.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with its sessions in six lanes: Building, Running, Needs you, In review, Done and Archived, with the Board and List switch at the top right">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### List view

Scan every session in one table. Each row holds the state node, the issue key, the title, the project, the same one signal as the card and the time of the last update, in columns that line up from row to row. The list is split by the same stages as the board, in the same order: **Building**, **Running**, **Needs you**, **In review**, **Done**, then **Archived** when you show archived sessions. Each group says how many sessions it holds from two on, an empty stage is left out, and each group name has one small dot in the color of its stage, the same color as its board lane, so a row keeps only its state node. The list follows the filter's sort and status, says how many sessions the filters hide, and a click opens the session. A session with no activity for three days stays in its stage, and its last column reads its age like every other row, such as "4d ago".

### Done and Archived lanes

Finished work stays in view. A session that never opens a pull request reaches **Done** too: an answer from a read-only agent, a report, a plan, or a finished edit in a folder with no branch reads **Done** with the reason "answered", "report ready", "plan ready" or "finished" in the hover card, once its reply is read and nothing is running or open; writing again brings it back. A session whose pull request merged or closed also leaves the sidebar's live list at once, unless you wrote after the merge. The **Done** lane header carries a **⋯** menu with **Archive all in Done** and **Archive done older than 7 days** (by the session's last activity), each asking the same archive confirm as the card menu and offering **Undo**. **Done** and **archived** are lanes like the others, and **Restore** on an archived card puts the session back where it belongs. On a narrow window the two share the last lane.

### Session card

Read a task at a glance: its title on two lines, its project in gray, and one signal at the right. The signal is the first that applies. A card in **Needs you** says why in words, the winning reason of the session registry: "Plan v3 waits for your approval", "2 questions for you", "Changes requested", "Approved, ready to merge", "An agent stopped on an error"; the list rows show the same words. In the other lanes it is a failed check or an open question, then the pull request in its state color (click it to open the pull request), or a running dot with the number of agents at work (the number shows from two on). Age, linked issues, agent count, cost, the pin and draft review comments wait in the card that opens when you rest the pointer on it. When one action waits on you, such as an open question, a round button on the card opens it, and a card in **Needs you** with no action of its own gets one that goes where the reason is cleared (the same place the top bar chip opens), named with the same words; the hover card also opens when the title takes keyboard focus; the rest of the session's verbs are in the card's right-click menu, among them **Mark as unread** and **Mark as read**. A thin colored line at the card's left edge tells its stage at a glance: gray while building, blue and breathing while running, amber when it needs you, green in review, purple when done, and gray again once archived.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-light.webp" width="572" alt="Four session cards: Warn merchants before a payout hold in notify-relay and Fix the rounding drift in the settlement export in ledger-core, each with an open question mark at the right, and Stop retried webhooks posting a second credit in payments-api with pull request #318 and Reconcile the settlement export in ledger-core with pull request #90, each with its pull request in green">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Bulk select

Tidy many sessions at once. A card has no checkbox: **Shift** click picks a range, **Option** click adds or removes one card, a lasso with Option held picks the cards it crosses, **Shift+Enter** and **Alt+Enter** do the same from the keyboard, **Select** in a card's right click menu picks it, and **⌘A** picks them all. Then **Archive**, **Restore** or **Delete** them from the bar at the bottom. Archive asks once for all of them, saying when agents are still running (they keep running), and Delete asks first. Archive and Restore can be undone, and when some sessions could not be archived the bar names them with **Retry**.

## Under the hood

This part is for contributors and agents who change the feature.

- Done lane menu: `DoneLaneMenu`, the `doneLane` object kind and `doneLaneArchivesOf` give the **Archive all in Done** and **Archive done older than 7 days** actions.
- Card signal: `boardSignalOf` reads `attentionWordsOf`, so a new reason needs no second table.
- Card action in **Needs you**: `attentionPlace` is the place the top bar chip opens.
