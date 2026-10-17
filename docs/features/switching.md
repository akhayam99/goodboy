# Switch between tasks

Move between the tasks of a workspace without losing your place, and see from any screen which one needs you.

### Session list

The left column lists the sessions of the workspace, one line each, with a sign that says whether an agent is working, you must act, or the task is done. Sessions that need you sit on top, and the open one shows its pages under its row. A session nobody touched for three days moves to an **Inactive** group at the bottom, newest first; rest the pointer on it to see when it last moved. A pinned session, the open one, one with work running or waiting on you, an unread reply or a draft never moves there, and touching an inactive session brings it straight back up. Hold **Control** and press **Tab** to flip through recent sessions without the list.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-light.webp" width="670" alt="The left column of the Northwind workspace: New session, the doors Board, Tasks, Chat and Workflows, and the Sessions list of one-line rows with a state sign and a title. The open session Fix webhook retries shows its pages Overview, Branch with 2 branches, Runs, Agents with 1 running and Artifacts, and a card beside its row reads Running, pull request 318 Draft with checks passing, HBL-212, payments-api, notify-relay and 2 agents">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-light.webp" alt="The Sessions options menu open in the left column of the Northwind workspace, with Sort set to Needs you first, Alphabetical, Last activity and Created, Group set to None, PR state, Stage and Project, Filter by project and a View section with Show archived">
</picture>

<sub>Screenshot from Goodboy 0.21.1</sub>

### Pin a session to keep it at the top

Keep the sessions you return to at the top of the list. **Pin session** in a row's right-click menu moves it to a **Pinned** group that ignores sort and filters, and **Unpin session** puts it back. Pinned sessions keep their order on the Board and in the folded sidebar too.

### Now chip

Know what needs you from any screen. The chip in the top bar counts sessions that need you and the ones running, and a click opens a list where each row jumps to its session.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-light.webp" alt="The top bar chip 2 needs you, 2 running opened into the panel Now in Harborline over the Board: NEEDS YOU 2 with Warn merchants before a payout hold and Fix the rounding drift in the settlement export, and RUNNING 2 with Speed up the payout export for large merchants and Nightly reconciliation before the Monday close">
</picture>

<sub>Screenshot from Goodboy 0.21.0</sub>

### Notifications

Catch up in one place. Everything Goodboy has to tell you, from a pull request opened to a session near its limit, lands in one list behind the bell, and **Needs action** shows only what waits on you.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-light.webp" alt="The Notifications page for Harborline: All notifications, 6 notifications, 4 unread, with Pull request opened for payments-api #318, Session reached 80% of its cap with an Open spend button, Handoff degraded, and 1 session folder left on disk with a Review storage button, and a left column of views, severity, source and workspace filters">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Open in new window

Give each workspace its own window, so switching does not interrupt running agents. After a reload or an update, every window comes back on the screen it showed.
