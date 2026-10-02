# Switch between tasks

Move between the tasks of a workspace, and see from any screen which one needs you.

### Activity bar

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-light.webp" width="420" alt="The activity bar of the Harborline workspace: sessions grouped under Building 2, Running 2, Needs you 1 and In review 1, with Stop retried webhooks posting selected, 1 to answer and HBL-412">
</picture>

Move between tasks without losing your place. The bar on the left of every session lists all the sessions of the workspace, grouped by where they stand: **Building**, **Running**, **Needs you** and **In review**, with done work folded away. Each row says what it is waiting on, like **1 to answer** or **draft PR #90**, so you open the one that needs you, and its Overview shows what ran, what was decided and what comes next.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-light.webp" alt="The Display options menu of the activity bar, open over the Harborline sessions, with Sort by Recent, Oldest and A-Z, and Group by Stage, Pull request and None">
</picture>

The **Display options** button at the top of the bar sorts sessions by **Recent**, **Oldest** or **A-Z**, and groups them by **Stage**, **Pull request** or **None**. The filter button next to it narrows the bar to one project.

### Now chip

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-light.webp" alt="The top bar chip 1 need you, 2 running opened into the panel Now in Harborline: NEEDS YOU 1 with Fix the rounding drift in the settlement export, and RUNNING 2 with Speed up the payout export for large merchants and Stop retried webhooks posting a second credit">
</picture>

Know what needs you from any screen. The chip in the top bar counts sessions that need you, running sessions and running scripts. Click it to open **Now in Harborline**, which lists each one, and click a row to jump to that session.

### Notifications

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-light.webp" alt="The Notifications page for Harborline: All notifications, 6 notifications, 4 unread, with Pull request opened for payments-api #318, Session reached 80% of its cap with an Open spend button, Handoff degraded, and 1 session folder left on disk with a Review storage button, and a left column of views, severity, source and workspace filters">
</picture>

Catch up in one place. Everything Goodboy has to tell you, from a pull request opened to a session close to its spending cap, lands in one list: a bell with an unread count, and a page grouped by severity, source and workspace. **Unread** and **Needs action** cut it down, and a row that needs you carries its next step, like **Open spend** or **Review storage**.

### Open in new window

Give each workspace its own window, so switching does not interrupt running agents. A workspace that is already open brings its window forward instead of opening twice. After a reload or an update, and on every launch with **Reopen last workspace on launch** on, every window comes back on the screen, tab and panel it showed.
