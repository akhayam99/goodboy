# The Browser page and moves

> **Read this when** you change the Browser page or a move to and from the
> dock. **Not for** the shared controls ([pane.md](pane.md)).

Open full page opens the Browser page, a studio kind of its own
(`{ kind: 'browser', sessionId, tabId }`), like the Terminal page. While it is
open, the Browser button on the right rail is selected and does nothing.

## The groups

The groups sit in the address row, with no column beside the page: each
project's pins first as square favicons, then one group per session in the
workspace's session order, behind a label with its title
(`BrowserTabGroupLabel`).

- A click on a label folds the group while the page is open: its tabs leave
  the row, the shown one excepted, and the label shows their count.
- The groups ignore the sidebar's sort and filters, which could hide a session
  that holds a tab.
- A pin opens in the picked session when it works on that project, else in the
  first session that does.
- The picked session keeps its group with no tab, so New tab opens in it. With
  pins and no session tab, the page opens on a session that hosts a pin; with
  neither, it says so.

## The view

The view is the pane's: the same address row, model, placement loop and
overlay rule. The row ends with Dock, and the band closes the page. Esc steps
back from a request detail first, then closes the tools dock while focus is on
the Console button or in the dock ([console.md](console.md#the-dock)), then
closes the page. Select an element works as in the pane
([pick.md](pick.md)). The dock stays in the store but is not mounted, so the
page alone places the view.

### One view, one place

A placement owns the live ids it showed and hides only a view it still owns,
retries included. The pane's late hide cannot take the view off the page, and
a pane that still holds the view waits while the page owns it, then shows it
again once the page lets it go.

## The route

The route names the session and the tab. Picking a row amends it; a close or a
new tab moves it to the tab now shown. A reload of Goodboy (⌘⇧R) reads it back,
so the page returns on the same tab. A route with no session opens on the
first session holding a tab, at its first tab, and names that session.

The band's trail names the picked session and opens it. Dock moves the page
back into the dock on the tab. The empty page keeps Dock too, which opens the
workspace dock, so the page is never a dead end.

## The count

The Browser button counts the rows the page lists: the tabs of the workspace's
sessions plus the pins of its projects, named `Browser, 3 tabs`, whether or not
a page is open. The store keeps it (`browserTabCounts`), so the rail does not
recount on every write. Until the rail's first load lands, the button has no
count, not a zero.

## Moves

A move never reloads: the same webview, with the same id, gets new bounds. A
half typed form and the scroll stay. A tab cannot move to another window.

- **One header order** for both docks: what the tool shows first (the
  Terminal's folder pill, the Browser's address), its own buttons, then More,
  Open full page and Close. The Terminal keeps its own tab strip
  (`ToolTabStrip`, `toolTabClassName`); the Browser's tabs sit in the address
  row, which never wraps, and its head holds only Open full page and Close,
  with the page actions on the chevron beside the address. On a full page the
  last control of the first row is **Dock** (`DockButton`, `NAMES.dock`) for
  both.
- **Open full page** (`NAMES.openFullPage`, shared with the Terminal dock), in
  the pane head only, pushes the page on the session and the shown tab
  (`promoteBrowserTab`), so ⌘[ brings the dock back.
  The page's placement takes the view by the owner rule.
- **Dock** closes the page and opens the dock on that session
  (`demoteBrowserTab`), beside the place under the page. The page hides the
  view and lets it go, and the pane shows the same tab, since both read the
  session's shown tab in this window.

A host failure while the page places the view shows under the page's address
row and leaves the view with the pane, which shows it again on Dock. A page
show that answers after the tab went back is hidden again, and the pane takes
the view.

## Under the hood

- `features/browser/components/BrowserStudio/`, groups in
  `browserPageGroups.ts`, route sync in `hooks/useBrowserStudioTab`. Sessions
  come from `browserScopeSessions`; the count from `workspaceTabCount`, kept by
  `keepTabCounts` and read through `selectBrowserTabCount`.
  `loadWorkspaceTabs` skips a session written while the read ran.
- Tests: `BrowserStudio/index.test.tsx` (moves keep one live id with no
  reload), `createNativePlacement.test.ts`, `leaveWithLiveTab.test.tsx`
  (`ux39-p11-browser-session`) and `restoreLocation.test.ts`. Scenes:
  `browser-page`, `browser-page-dark`.
