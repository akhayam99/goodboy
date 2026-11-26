# Switch between tasks

Move between the tasks of a workspace without losing your place, and see from any screen which one needs you.

### Sessions

Sessions in the top bar opens the list of the workspace's sessions, from any screen. **⌘B** opens and closes it.

The list is a search field, then the sessions in groups: **Pinned** first, then **Needs you**, **Running**, **In review** and **Building**.

- A row that needs you carries a yellow dot, a running row a blue one, and a broken row keeps its red mark. **Sessions** itself carries the yellow dot while any session needs you.
- A row counts what waits on you in that session.
- A session with an agent at work says what it does in place of its project, the same line as its Board card.

Type to narrow by title or project, move with the arrows and press **Enter** to open a row on its Overview. Click a pin to move a row in or out of **Pinned**. **Open Board** at the foot opens the Board, with the finished sessions too.

#### Keys for places

- **⌘N** opens New session, at the top of the places rail.
- **⌘⇧H** opens the Board.
- **⌘O** opens the workspace switcher, and **⌘1** to **⌘9** switch workspaces.
- **⌘,** opens Settings and **⌘I** reports a bug, both at the foot of the rail.

#### Move between sessions

- **⌘⇧[** and **⌘⇧]** go to the previous and next session, in the order of the list.
- **Control+Tab** flips through recent sessions without the list.
- The funnel in the Board header sorts, groups and filters the sessions of the board.
- Pick several sessions and archive, restore or delete them on the Board: see [the board](board.md#bulk-select).

### Pin a session to keep it at the top

Keep the sessions you return to at the top of the list. The pin on a row of the Sessions list, or **Pin session** in the session's action menu, moves it to a **Pinned** group that ignores sort and filters, and **Unpin session** puts it back. Pinned sessions keep their order on the Board.

### Now chip

Know what runs from any screen. The chip in the top bar counts the sessions and scripts running, and reads a muted **Idle** when nothing does. It never says what needs you: **Sessions** at the top left carries a yellow dot for that.

A click opens a list where each row jumps to its session and says what its agent is doing, the same line as its Board card.

#### Sessions that need you

- An amber number on **Board** in the places rail counts them, red when one of them is broken, 9+ above nine. The top bar does not repeat the number.
- **⌥⌘↓** goes to the next one. Click the number for the board, where what needs you leads **Running**.
- The count ignores the project filter, so a session in another project is still counted.
- A run that stopped, paused at its limit or waits for you to continue, a Lead waiting for your OK and a Slack reply waiting for approval count like a question does.
- A reply to read or an approval to merge shows only a quiet gray dot, not a number.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-light.webp" alt="The top bar chip 2 running opened into the panel Now in Harborline over the Board: Running 2 with Speed up the payout export for large merchants and Nightly reconciliation before the Monday close, each with agent running, and Open Monitoring, while Board in the places rail carries the amber 2 of the sessions that need you">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Notifications

Catch up in one place. Everything Goodboy has to tell you, from a pull request opened to a session near its limit, lands in one list behind the bell.

#### The list

- **Needs action** shows only what you still owe. A retry or an update stays there until it resolves or you delete it.
- A link such as Open spend or Open Checks is marked Opened, read and out of that list the moment you use it, from the row or from the toast.
- Opening the bell marks nothing read. A row is read after a second on screen, and **Mark all as read** clears the rest of the list you are looking at, this workspace or all workspaces.
- An unread row carries a small dot, amber when a retry waits on it. The bell shows the number of unread rows, 9+ above nine.
- **Open all notifications** at the foot of the list opens the Notifications page. Esc, Back or any other destination leaves it.
- With more than one workspace the bell has **This workspace** and **All workspaces**, and the second shows how many sessions need you in the other workspaces.

#### Open the item

The bell, the toast and the Notifications page open the same place, and the button names it: Open agent, Open Questions, Open Comments, Open Changes, Open Checks, Open run, Open the Lead, Open branch, Open pull request (Open merge request on GitLab) or Open session. It opens the notification's own workspace first, in the window that shows it.

#### When something fails

An error from an action ends in its way out:

- A failed push offers **Retry push** and says your work is still on the branch.
- A rejected sign-in offers **Reconnect** with the tool's name.
- A missing editor opens Settings.
- A settings save that failed says nothing was changed.

#### While you are away

Leave agents working and look away. While no Goodboy window is in front, the app icon shows the number of sessions that need you in all your workspaces, and clears as they are answered.

A system banner also appears when a session starts to wait on a question, a permission, a plan approval, an agent error, a failed push or failing checks. It is one per session and reason, titled with the session, and a click on it opens that session. Three or more within 30 seconds become one banner for the workspace.

The first time something waits while you are away, a toast asks once whether to turn banners on. **Settings › This Mac › Look and alerts › Notifications** holds two switches, **Banner when away** and **Dock badge**. Both are local to this Mac: nothing is sent anywhere.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-light.webp" alt="The Notifications page for Harborline on All, 6 notifications and 4 unread: Pull request opened, Session reached 80% of its cap, Handoff degraded, 1 session folder left on disk, Branch moved outside Goodboy and Codex connected, with Mark all as read and a More menu, and a left column of views, severity and source filters">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Open in new window

Give each workspace its own window, so switching does not interrupt running agents. After a reload or an update, every window comes back on the screen it showed.

Closing a window while its agents work asks once: **Stop 2 agents**, or **Cancel**. An agent that does not stop says so, with **Close anyway**. On a Mac the main window hides instead of closing, so agents keep working; the dock icon brings it back.

Switching workspace or disconnecting one stops its agents the way **Stop** does. On return each reads **Stopped by you** with **Continue**, and nothing half done reads Done. An agent that does not stop keeps you where you are: nothing is switched or disconnected, a warning says so, and you can stop it and try again.
