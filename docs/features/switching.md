# Switch between tasks

Move between the tasks of a workspace without losing your place, and see from any screen which one needs you.

### Sessions

Sessions in the top bar opens the list of the workspace's sessions, from any screen. **⌘B** opens and closes it. The first time you open Goodboy after an update that took the sessions out of the left column, a card under the control says **Your sessions moved here**. **Show sessions** opens the list, and opening it in any way closes the card for good. It does not come back, and a new install never shows it.

The list is a search field, then the sessions in groups: **Pinned** first, then one group per state. Type to narrow by title or project, move with the arrows and press **Enter** to open a row on its Overview. **Open Board** at the foot opens the Board. The list keeps a margin from every window edge and scrolls inside.

**Where each row of the old sidebar went**

| In the sidebar                                     | Now                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| New session                                        | Top of the places rail, **⌘N**                                       |
| Board, Tasks, Workflows, Chat, Connections, Impact | The places rail, in that order (**⌘⇧H** opens Board)                 |
| Monitoring                                         | The right rail, as **Monitor**                                       |
| The session list, Pinned and Done                  | Sessions in the top bar (**⌘B**) and the Board                       |
| The workspace name                                 | The workspace mark at the top of the rail (**⌘O**, **⌘1** to **⌘9**) |
| Settings, the bug icon                             | The foot of the rail (**⌘,**, **⌘I**)                                |

**⌘⇧[** and **⌘⇧]** still go to the previous and next session, in the order of the list. **Control+Tab** still flips through recent sessions without the list.

**Sort, group and filter.** The funnel in the Board header sorts, groups and filters the sessions of the board. Pick several sessions and archive, restore or delete them on the Board: see [the board](board.md#bulk-select).

### Pin a session to keep it at the top

Keep the sessions you return to at the top of the list. The pin on a row of the Sessions list, or **Pin session** in the session's action menu, moves it to a **Pinned** group that ignores sort and filters, and **Unpin session** puts it back. Pinned sessions keep their order on the Board.

### Now chip

Know what runs from any screen. The chip in the top bar counts the sessions and scripts running, and reads a muted **Idle** when nothing does, so the chips beside it stay put. With a session that needs you it reads **Needs you** instead. A click opens a list where each row jumps to its session. Sessions that need you show as an amber number on **Board** in the places rail, red when one of them is broken, 9+ above nine. The top bar does not repeat it; **⌥⌘↓** goes to the next one. Rest on it for the reasons, and click it for the board, where **Needs you** comes first. The count ignores the project filter, so a session in another project is still counted, and the board says **2 more need you in other projects** with a way to clear the filter. A reply to read or an approval to merge shows only a quiet gray dot, not a number. A run that stopped, paused at its limit or waits for you to continue, an Auto agent waiting for your OK and a Slack reply waiting for approval count like a question does.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-light.webp" alt="The top bar chip 2 running opened into the panel Now in Harborline over the Board: Running 2 with Speed up the payout export for large merchants and Nightly reconciliation before the Monday close, each with agent running, and Open Monitoring, while Board in the places rail carries the amber 2 of the sessions that need you">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Notifications

Catch up in one place. Everything Goodboy has to tell you, from a pull request opened to a session near its limit, lands in one list behind the bell, and **Needs action** shows only what you still owe: a retry or an update stays there until it resolves or you delete it, while a link such as Open spend or Open Checks is marked Opened, read and out of the list the moment you use it, from the row or from the toast. The bell, the toast and the Notifications page open the same place, and the button names it: Open Comments, Open Files (a fix that waits on a note only), Open Checks, Open branch, Open pull request (Open merge request on GitLab) or Open session. A fix notice stores note or comment, and the landing and the label follow it. A push failure keeps its mount. All three open the notification's own workspace first, in the window that shows it. Checks and Comments wait for the request data before they open. A notification from before this keeps no place and opens its session. An error from an action ends in its way out. An error already shown under the button that started it lands read and makes no toast. A failed push offers Retry push and says your work is still on the branch. A rejected sign-in offers Reconnect with the tool's name. A missing editor opens Settings. A settings save that failed says nothing was changed. Opening the bell marks nothing read: the list scrolls instead of cutting off, a row is read after a second on screen, the rows out of sight stay unread and the list says how many, and **Mark all as read** clears the rest. An unread row carries a small dot, amber when a retry waits on it, and the bell shows the number of unread rows (9+ above nine) beside its dot. **Open all notifications** at the foot of the list opens the Notifications page, and the bell stays pressed for as long as that page is open. The page has no Close button: Esc, Back or any other destination leaves it. With more than one workspace the bell has **This workspace** and **All workspaces**, and the second shows how many sessions need you in the other workspaces.

Leave agents working and look away. While no Goodboy window is in front, the app icon shows the number of sessions that need you in all your workspaces, the count of the workspace you work in plus the others, and clears as they are answered. A system banner also appears when a session starts to wait on a question, a permission, a plan approval, an agent error, a failed push or failing checks: one per session and reason, titled with the session, with the sentence the board shows, and a click on it opens that session. Three or more within 30 seconds become one banner for the workspace. The first time something waits while you are away, a toast asks once whether to turn banners on. **Settings › General › Notifications** holds two switches, **Banner when away** and **Dock badge**. Both are local to this Mac: nothing is sent anywhere. A toast that arrives while the window is behind others waits until you come back before its timer starts.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-light.webp" alt="The Notifications page for Harborline on All, 6 notifications and 4 unread: Pull request opened, Session reached 80% of its cap, Handoff degraded, 1 session folder left on disk, Branch moved outside Goodboy and Codex connected, with Mark all read and a More menu, and a left column of views, severity and source filters">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Open in new window

Give each workspace its own window, so switching does not interrupt running agents. After a reload or an update, every window comes back on the screen it showed. Closing a window while its agents work asks once: **Stop 2 agents**, or **Cancel**. A run deciding its next step counts too. An agent that does not stop says so, with **Close anyway**. On a Mac the main window hides instead of closing, so Auto keeps working; the dock icon brings it back.

Switching workspace or disconnecting one stops its agents the way **Stop** does: on return each reads **Stopped by you** with **Continue**, and nothing half done reads Done. An agent that does not stop keeps you where you are: nothing is switched or disconnected, a warning says so, and you can stop it and try again.
