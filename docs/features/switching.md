# Switch between tasks

Move between the tasks of a workspace, and see from any screen which one needs you.

### Activity bar

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-light.webp" width="420" alt="The activity bar of the Harborline workspace: sessions grouped under Building 2, Running 2, Needs you 1 and In review 1, with Stop retried webhooks posting selected, 1 to answer and HBL-412">
</picture>

Move between tasks without losing your place. The bar on the left lists the sessions of the workspace, one line each: a small sign and the title. A turning ring means an agent is working, a **?** or **!** means the session needs you, a check means it is done, and a plain ring means it is quiet. The sessions that need you sit on top, and the rest follow the one you opened last.

Rest the pointer on a row for half a second, or move the keyboard focus to it, and a card shows where it stands: the stage, the pull request and its checks, the linked tasks, the projects, the agents, the spend and the last activity. The session you have open shows its pages under its row, **Overview**, **Branch**, **Runs**, **Agents** and **Artifacts**, each with its count.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-light.webp" alt="The Display options menu of the activity bar, open over the Harborline sessions, with Sort by Recent, Oldest and A-Z, and Group by Stage, Pull request and None">
</picture>

The options button in the **Sessions** header sorts the list by **Needs you first**, **Alphabetical**, **Last activity** or **Created**, groups it by **None**, **PR state**, **Stage** or **Project**, narrows it to a project and shows archived sessions. Goodboy keeps your choice for each workspace. The first eight rows show, and **Show more** opens the rest.

To switch without looking at the list, hold **Control** and press **Tab** to flip through your recent sessions, then let go to open one. **Option Command Down** jumps to the next session that needs you.

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
