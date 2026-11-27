# Browser keys and ⌘K

> **Read this when** you change a browser shortcut, page keys or the ⌘K
> entries. **Not for** the app keymap
> ([../features/keyboard.md](../features/keyboard.md)).

## The keymap

Nine entries in `shared/keyboard/browserShortcuts.ts`, all `scope: 'browser'`,
registered by `useBrowserKeys` while the pane or the Browser page is on
screen. Elsewhere each chord keeps its other meaning: ⌘L Ask about this
session, ⌘T a new terminal tab, ⌘W `app.close`, ⌘F Search, ⌘⇧[ and ⌘⇧] the
sessions.

| Chord       | In the browser                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⌘L          | Opens the pill.                                                                                                                                                          |
| ⌘T          | Starts a draft: the command field opens empty.                                                                                                                           |
| ⌘D          | Toggles the pin.                                                                                                                                                         |
| ⌘⇧S         | Sends the shown page to the agent ([doors.md](doors.md#send-to-agent)).                                                                                                  |
| ⌘⇧[ and ⌘⇧] | Step `stepTab` order: tabs, then pins, wrapping.                                                                                                                         |
| ⌘W          | Closes the shown tab through `close`. A pin is never closed and consumes the key; with no tab shown the handler declines (`canDecline`) and `app.close` closes the pane. |
| ⌘⇧T         | Reopens the newest closed tab.                                                                                                                                           |
| ⌘F          | Opens the find bar ([pane.md](pane.md#find-in-page)).                                                                                                                    |

⌘⇧T opens the newest entry of `browserClosedTabs[sessionId]` with `openPage`
and drops it only once the open succeeded, so a failure leaves it for a retry.
The stack is per session, in memory, five deep: `closeTab` pushes the row in the
same commit (`pushClosedTab`), and `closeBrowserSessionTabs` and archive
eviction clear it. The rail entry, the tab close button and New tab teach their
chord in the tooltip, and the page menu's Pin row shows ⌘D. The console (⌘⇧J) and the picker (⌘⇧C) are on their own pages.

## A focused page and the app's keys

After a click inside a tab the native view has focus, and a JS-only shortcut
never reaches the app.

On macOS one `NSEvent` local monitor (`platform/key_monitor.rs`) catches a key
down whose first responder sits inside a tab view (each carries its
`browse-<id>` label as identifier).

1. For a page key it swallows the event.
2. It emits `browser://page-key` `{ tabId, combo }` to the tab's window and
   gives native focus back to that window's app view.
3. `usePageKeys` replays the combo on `window` through `replayCombo`, so the
   dispatcher and the scopes decide. A chord from a closed tab is dropped.

The page keys are every `browser.*` entry and ⌘K, pushed through
`browser_page_keys` as `platformCombo` strings, so a rebound shortcut moves
with them. Only chords holding ⌘ count: a plain key belongs to the page, and
⌘C, ⌘V, ⌘A and ⌘Z are never pushed. ⌘R, ⌘⇧R and ⌘⇧W (File, Close the panel,
the way out of a Browser over the page in a narrow window) are never page
keys: the menu bar brings them to the window. A bare Escape never leaves the
page.

Linux and Windows have no monitor: after a click inside a tab none of these
chords fire until focus returns to the chrome (the address row, a tab, the
rail). The find bar and the command field keep focus in the chrome on purpose.

## ⌘K entries

⌘K lists every session's browser tabs and every project pin
(`useBrowserEntries`, `browserPageData`), with the session title as detail and
`Pinned` as a pin's tag. Picking one shows that exact tab on its session
(`showBrowserTab`, `showBrowserPinTab`).

- `Open <address>` comes first, beside that session, for an `http` or `https`
  address, a localhost name, or a host with a port or a path.
- A typed path to a page, an image or a PDF gets `Open <path>`
  (`typedLocalPathOf`), and nothing with no session.
- With no workspace open the entry reads `In your browser`.
- `foo.ts:42`, `plan.md/x` and a bare word with a dot stay a search
  (`typedAddressOf`).

## Under the hood

- `browser/page_keys.rs` holds the chord parse, the key codes, the `PageKeys`
  state and `route_page_key`. The ⌘K entries come from
  `palette/hooks/useBrowserEntries` and `typedAddressOf.ts`.
- Tests: `components/BrowserPane/keys.test.tsx` (the keymap on the real
  store), `doors.test.tsx` (⌘L beside Ask, the ⌘K entries). Scenes:
  `browser-pane-keys`, `browser-pane-keys-dark`.
