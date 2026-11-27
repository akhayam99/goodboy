# Doors and the click rule

> **Read this when** you change a door, Send to agent or `openTarget`.
> **Not for** the keymap and ⌘K ([keys.md](keys.md)).

## Doors

A door names its session and an address, and one function opens it
(`openInBrowser`). It opens the dock on that session, beside the session view
or a page over it (the Terminal page); on the Browser page it switches to that
session. A door with no session, such as a terminal on a plain folder, opens
your browser.

Which tab it shows:

- a tab of the session already on that address;
- for a bare server address (`http://localhost:5173`), any tab on that server;
- otherwise a new tab. A host failure keeps the old tabs and reports on the
  session.

Every door that shows or opens a tab ends the New tab draft
(`endBrowserDraft` bumps `browserDraftEnds`, which the pane watches), also for
the active tab. A later door cancels an older open still waiting on the host,
so the last click wins. A tab picked in ⌘K shows that exact tab
(`showBrowserTab`).

The doors:

- **Server chips**: a terminal tab's port chip and a running Service's live
  port open `http://localhost:<port>`.
- **Links**: any anchor in rendered text (a turn, a decision, an artifact, a
  pull request body, an inbox row, a plan comment) is claimed by
  `claimSessionLink` and routed through `openTarget`. The session is the
  `data-browser-session` ancestor, else the store's current session
  (`sessionOfElement`). A GitHub commit link still opens its diff.
- **Terminal links**: `GenericTerminalPanel` hands a printed web link and its
  click to `onOpenWebLink`; without the prop, as in the provider's inline
  terminal, it opens your browser. The terminal pane passes its tab's session.
- **Peek**: resting on or focusing a `localhost` link in a session, or any web
  address in a terminal, shows the tab's title (or the host), the address and
  what a click does, in words from `webLinkPeekWords.ts`, which reads the same
  place `openPlaceOf` picks. It never creates a tab.

Chips, session links, a Service's port and a terminal's printed addresses call
`openWebLink`, which hands the address to the click rule. The
⌘-click listener runs after the page's own handlers and skips a click they
handled, so an anchor with its own `onClick` opens your browser once. ⌘-click
on a terminal file path still opens your editor.

## Send to agent

Send to agent sends a tab's text to the session's agent: the first row of the page menu,
the tab's right-click menu (the `browserTab` kind of the action registry) and
`browser.sendToAgent` (⌘⇧S), all through `sendPageToAgent`.

1. The press names the tab, the session, its host and the agent the composer
   would send to (`useHandOutputToAgent`).
2. Rust reads the tab for that press only (`browser_page_text`). It refuses a
   tab of another session (`other-session`), a page that is not `http` or
   `https` (`not-web-address`) and a live host that is not the pressed host
   (`host-unknown`).
3. The read is bound to the navigation it checked. The registry counts each
   main-frame commit (`mark_navigated`, from the `Started` load), and the
   command reads that count before the host check and after the text, and
   refuses with `page-moved` when it changed. The page's own address is checked
   too, only as a second guard, since the page writes it.
4. The script reads `document.body.innerText` only, no markup and no cookie,
   cut at 60,000 characters with a note (`platform/web_text.rs`).
5. The UI runs `redactSecrets`, puts the address and a line saying it is page
   content first, and queues a `text/markdown` file with a `source` of `page`
   (`pageAttachmentOf`) through `outputHandoffs`, so the ten-file cap and the
   draft restore apply.

The run goes through the action runner under `browser.sendPage:<session>`: one
read at a time per session, a failure shows `ActionRunLine` with Retry, and a
read that finishes after its run was cleared is dropped by its token. A page
never calls this command; it is walled like every other.

## The click rule

`openTarget` in `features/open/` decides where a target opens: a web address, a
saved copy (a plan or a report as a page on disk), a file or a folder.

### Files, folders and text links

- A file opens in the editor Settings names (or the first detected) at its
  line; with no editor and a session, in the in-app file drawer.
- A folder opens in the editor, else the file manager. A menu that picks an
  editor passes it in the target. Shared code asks for a folder with the
  `goodboy:open-folder` window event.
- A missing file says so through `reportError` with the path ("is missing"),
  or on the run line from an action control (`openFolderAction`,
  `openTargetOrThrow`).
- A relative or `file:` link in rendered text is a file target in the folder
  of the session's active mount. With no session or folder it says so once and
  opens nothing.

### Beside the session or outside

A plain click on a web address, a plan or a report opens a tab beside the
session when Links says **In Goodboy** (the default), and your browser when it
says **In your browser**.

- ⌘-click (Ctrl-click off macOS) always opens your browser.
- With no session, it opens your browser whatever Links says; the Links help
  text says "in a session".
- A wireframe always opens your browser: it is agent-written HTML with
  scripts, held back until the wall audit.
- `place: 'outside'` forces your browser: the sponsor link, bug report and
  crash links, the Jira, Linear, Sentry and Slack connect steps, the provider
  connect and reset links, and a saved copy opened from the Storage page.

A saved copy beside the session opens as a local tab (`openBeside`, kind
`local`) at the path Rust returns (`artifact_mirror_path`, which keeps
`refuse_executable` and the plain `.html` rule); Rust launches nothing.
Outside, `artifact_mirror_open` launches it with the Browser app chosen in
Settings.

### One decision, read once

`openPlaceOf` is the pure answer from the target kind, Links, the command key
and the session; the peek reads the same answer. `openWebLink` and
`openSavedCopy` are thin callers.

- The target, the session and the command key are captured at the click,
  before the Links read. An unreadable setting counts as the default and
  warns.
- A late open lands in the session of the click, never the current one, and a
  second window opens in its own.

Nothing outside `features/open/` imports `openUrl`, `openInEditor` or
`openArtifactMirror`; the `raw-open` guard in `forbidden-patterns` keeps that
at zero.

### A failure is said once

A link calls `openLink`, which reports through `reportError` with the target
named. An action control calls `openLinkOrThrow` through the runner, so the
failure lands on the run line with Retry. A caller that shows the reason in
place (the saved copy line, the wireframe note, a run line) uses
`openTargetOrThrow` and reports nothing itself. The tab is added only after the
open resolves. Retry is the click; there is no undo, close the tab.

## Under the hood

- `openInBrowser.ts` opens and `tabForAddress.ts` picks the tab. In
  `features/open/`, `openTarget.ts`, `openPlaceOf.ts`, `readLinksOpen.ts` (one
  read), `isOwnBrowserClick.ts` (the modifier), `openWebLink.ts`,
  `openSavedCopy.ts` and `openTargetOrThrow.ts`; `shared/lib/linksOpenOf.ts`
  and `linksOpenSetting.ts` name the setting.
- `sessionOfElement.ts` reads `data-browser-session`, `claimSessionLink.ts`
  takes links from `useCommitLinkInterceptor`, `hooks/useOwnBrowserLinkClicks`
  takes ⌘-click, and `components/BrowserLinkDoors` draws the peek through
  `WebLinkPeek.tsx`, shared with the terminal
  (`terminal/hooks/useTerminalWebLinks`).
- Tests: `doors.test.tsx`, `openWebLink.test.ts`,
  `features/open/openPlaceOf.test.ts`, `features/open/openTarget.test.ts`,
  `webLinkPeekWords.test.ts`, `GenericTerminalPanel/webLinks.test.tsx`,
  `LinksOpenField/index.test.tsx`, `tabForAddress.test.ts`. Scenes:
  `browser-peek`, `settings-links`, each with `-dark`.
