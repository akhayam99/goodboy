# Switch between tasks

Move between the tasks of a workspace without losing your place, and see from any screen which one needs you.

### Session list

The left column lists the sessions of the workspace, one line each, with a sign that says whether an agent is working, you must act, or the task is done. Sessions that need you sit on top, and the open one shows its pages under its row. A session nobody touched for three days moves to an **Inactive** group at the bottom, newest first; rest the pointer on it to see when it last moved. A pinned session, the open one, one with work running or waiting on you, an unread reply or a draft never moves there, and touching an inactive session brings it straight back up. Hold **Control** and press **Tab** to flip through recent sessions without the list. The funnel at the right of the **Sessions** row sorts, groups and filters the list: **Sort** and **Group** on top, then checkboxes for the statuses and projects that have sessions, **Show archived**, and **Reset** once anything is changed, and a right click on any session opens all its actions: pin, refresh, rename, archive and delete (archive and delete ask first, and an archived session comes back with Undo or Restore).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-light.webp" width="760" alt="The left column of the Northwind workspace: New session, the doors Tasks, Chat and Workflows, and the Sessions list of one-line rows with a state sign and a title, then Inactive 14. The open session Fix webhook retries shows its pages Overview, Runs, Orchestrated, Agents and Artifacts, and a card over its row reads Running, pull request #318 Draft with checks passing, HBL-212, payments-api, notify-relay and 2 agents">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-light.webp" alt="The Sessions options menu open in the left column of the Northwind workspace, with Status, Project, Archive with Show archived, Sort set to Needs you first, Alphabetical, Last activity and Created, and Group set to None, PR state, Stage and Project">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Pin a session to keep it at the top

Keep the sessions you return to at the top of the list. **Pin session** in a row's right-click menu moves it to a **Pinned** group that ignores sort and filters, and **Unpin session** puts it back. Pinned sessions keep their order on the Board and in the folded sidebar too.

### Now chip

Know what runs from any screen. The chip in the top bar counts the sessions and scripts running, and a click opens a list where each row jumps to its session. Sessions that need you show as an amber dot on **Sessions** in the sidebar: rest on it for how many and why, and click it for the board, where **Needs you** comes first.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-light.webp" alt="The top bar chip 2 sessions need you, 2 running opened into the panel Now in Harborline over the Board: Needs you 2 with Warn merchants before a payout hold and Fix the rounding drift in the settlement export, Running 2 with Speed up the payout export for large merchants and Nightly reconciliation before the Monday close, and Open Monitoring">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Notifications

Catch up in one place. Everything Goodboy has to tell you, from a pull request opened to a session near its limit, lands in one list behind the bell, and **Needs action** shows only what waits on you.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-light.webp" alt="The Notifications page for Harborline filtered on Needs action: Session reached 80% of its cap, Handoff degraded and 1 session folder left on disk, with Mark all read, Delete all and Close, and a left column of views, severity, source and workspace filters">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Open in new window

Give each workspace its own window, so switching does not interrupt running agents. After a reload or an update, every window comes back on the screen it showed.
