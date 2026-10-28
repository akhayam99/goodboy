# Switch between tasks

Move between the tasks of a workspace without losing your place, and see from any screen which one needs you.

### Session list

The left column lists the sessions of the workspace, one line each. The title is on the left. A sign on the right says whether an agent is working, you must act, or the task is done. Sessions that need you sit on top, and the open one shows its pages under its row.

**Pick several sessions**

There is no checkbox.

- **Shift** click picks a range.
- **Option** click adds or removes one.
- **Shift+Enter** and **Shift+Arrow** extend a range from the keyboard.
- **Select** in the right click menu picks the row.
- A quiet line under the list says so until you pick something.
- **Mark as unread** in the same menu keeps a row lit until you open it again. **Mark as read** clears it. With several rows picked, the bar says **Mark 3 as read**.

**Inactive**

A session nobody touched for three days moves to an **Inactive** group at the bottom, newest first. Rest the pointer on it to see when it last moved.

A pinned session, the open one, one with work running or waiting on you, an unread reply or a draft never moves there. Touching an inactive session brings it straight back up.

**Flip through recent sessions.** Hold **Control** and press **Tab** to flip through recent sessions without the list.

**Sort, group and filter.** The funnel at the right of the **Sessions** row sorts, groups and filters the list. **Sort** and **Group** come on top. Then come checkboxes for the statuses and projects that have sessions, **Show archived**, and **Reset** once anything is changed.

**Right click.** A right click on any session opens all its actions: pin, refresh, rename, archive and delete. Archive and delete ask first. An archived session comes back with Undo or Restore.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-light.webp" width="760" alt="The Northwind Sessions list in one-line rows with a state sign, Inactive 14, and a card over the open session Fix webhook retries">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-light.webp" alt="The Sessions options menu open in the left column of the Northwind workspace, with Status, Project, Archive with Show archived, Sort set to Needs you first, Alphabetical, Last activity and Created, and Group set to None, PR state, Stage and Project">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

The Sessions options menu ends with **Mark all as read**, which clears every reply you have not opened and is off when there is none. The session you are looking at counts as read, so **Mark as unread** is not offered on it while its last agent is the one on screen.

### Pin a session to keep it at the top

Keep the sessions you return to at the top of the list. **Pin session** in a row's right-click menu moves it to a **Pinned** group that ignores sort and filters, and **Unpin session** puts it back. Pinned sessions keep their order on the Board and in the folded sidebar too.

### Now chip

Know what runs from any screen. The chip in the top bar counts the sessions that need you, then the sessions and scripts running, and a click opens a list where each row jumps to its session, with the sessions that need you first and a **Next that needs you** button. Sessions that need you show as a number on **Sessions** in the sidebar, with a small amber dot and a muted number, the dot red when one of them is broken, 9+ above nine. The same count leads the chip in the top bar, as **3 need you**, and its tooltip teaches **⌥⌘↓**, the key to the next one. Rest on the door for the reasons, and click it for the board, where **Needs you** comes first. The count ignores the project filter, so a session in another project is still counted, and the board says **2 more need you in other projects** with a way to clear the filter. A reply to read or an approval to merge shows only a quiet gray dot, not a number. A run that stopped, paused at its limit or waits for you to continue, an Auto agent waiting for your OK and a Slack reply waiting for approval count like a question does.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-light.webp" alt="The top bar chip 2 sessions need you, 2 running opened into the panel Now in Harborline over the Board: Needs you 2 with Warn merchants before a payout hold and Fix the rounding drift in the settlement export, Running 2 with Speed up the payout export for large merchants and Nightly reconciliation before the Monday close, and Open Monitoring">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Notifications

Catch up in one place. Everything Goodboy has to tell you, from a pull request opened to a session near its limit, lands in one list behind the bell, and **Needs action** shows only what you still owe: a retry or an update stays there until it resolves or you delete it, while a link such as Open spend or Open in Activity is marked Opened, read and out of the list the moment you use it, from the row or from the toast. An error from an action ends in its way out. A failed push offers Retry push and says your work is still on the branch. A rejected sign-in offers Reconnect with the tool's name. A missing editor opens Settings. A settings save that failed says nothing was changed. Opening the bell marks nothing read: the list scrolls instead of cutting off, a row is read after a second on screen, the rows out of sight stay unread and the list says how many, and **Mark all read** clears the rest. An unread row carries a small dot, amber when a retry waits on it, and the bell shows the number of unread rows (9+ above nine) beside its dot. With more than one workspace the bell has **This workspace** and **All workspaces**, and the second shows how many sessions need you in the other workspaces.

Leave agents working and look away. While no Goodboy window is in front, the app icon shows the number of sessions that need you in all your workspaces, the count of the workspace you work in plus the others, and clears as they are answered. A system banner also appears when a session starts to wait on a question, a permission, a plan approval, an agent error, a failed push or failing checks: one per session and reason, titled with the session, with the sentence the board shows, and a click on it opens that session. Three or more within 30 seconds become one banner for the workspace. The first time something waits while you are away, a toast asks once whether to turn banners on. **Settings › General › Notifications** holds two switches, **Banner when you are away** and **Dock badge**. Both are local to this Mac: nothing is sent anywhere. A toast that arrives while the window is behind others waits until you come back before its timer starts.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-light.webp" alt="The Notifications page for Harborline filtered on Needs action: Session reached 80% of its limit, Handoff degraded and 1 session folder left on disk, with a More notification actions menu holding Mark all read and Delete all, and a left column of views, severity, source and workspace filters">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Open in new window

Give each workspace its own window, so switching does not interrupt running agents. After a reload or an update, every window comes back on the screen it showed.
