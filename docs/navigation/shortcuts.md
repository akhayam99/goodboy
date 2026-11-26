# Shortcuts

> **Read this when** you add or change a keyboard shortcut, a plain key a surface answers, an Esc handler or a per-OS combo. **Not for** the full key table users see ([keyboard.md](../keyboard.md)) or the one Esc stack of layers ([studios.md](studios.md#one-esc-stack)).

## One registry

There is one registry of shortcuts. Nobody writes a combo string by hand outside
it, so no two surfaces can claim the same chord and no shortcut can exist
without being documented. The plane is for the dispatcher.

| Plane   | Modifier | Holds                                              |
| ------- | -------- | -------------------------------------------------- |
| app     | ⌘        | app-wide chords                                    |
| session | ⌘⇧       | session chords                                     |
| lens    | ⌘⌥       | the lens surfaces                                  |
| `pane`  | none     | plain keys a surface answers while it is on screen |

The diff's `pane` keys are J and K (next and previous file), [ and ] (the same),
H and L, V, N, F, and / or T (focus the file filter).

### Plain keys

A plain key (no ⌘, Ctrl or Alt) yields on its own: the dispatcher skips it while
a field, a select or the terminal has focus, while a modal dialog is open, and
when something below already claimed the event. A surface registers its plain
keys with `useShortcut` and an enabled flag, never with its own window listener.

### Per-OS combos

An entry carries its own combo for other systems where the plain mapping would
collide.

- The terminal's new tab: ⌘T on macOS, Ctrl+Shift+T elsewhere, where Ctrl+T
  belongs to the shell.
- Report a bug (`report.open`): ⌘I on macOS, Ctrl+Shift+I elsewhere, because
  Ctrl+I is Tab in a terminal. It fires from anywhere, the terminal included.
- Ask (`ask.open`): ⌘L on macOS, Ctrl+Shift+L elsewhere, where Ctrl+L clears a
  terminal.
- Off macOS, typing wins over the lens plane. An AltGr character, or a Ctrl+Alt
  combo typed into a field or the terminal, never fires a shortcut.

### Reload

Reload (`view.reload`, ⌘R) reloads where you are: `reloadWhereYouAre` picks one
surface registered with `useReloadSurface`, first match wins:

1. a surface with a native view (the Browser pane and page) while the window page
   has no focus, because the keyboard is in its webview and the key reached the
   page through the menu bar;
2. the surface that holds the last click or focus;
3. the main surface on screen (the session, or the Browser page);
4. with none, nothing happens.

Reload Goodboy (`app.reload`, ⌘⇧R) is the only window reload.

## Groups, scopes and rows

- **Group.** Every entry names the task `group` it belongs to (General,
  Workspaces, Navigate, Session, Views, Lists, Comments, Changes, Window; ids stay
  `review` and `diff`). Settings > This Mac > Keyboard shortcuts lists the groups
  in that order, read top to bottom per column.
- **Scope.** An entry that works only in one place carries a `scope` (Tasks and
  Notifications lists, the Branch page, the terminal, a chat composer, an
  activity row, a workspace open, a code or an explore session). The page prints
  the place under the group name when the whole group shares it, or under the
  row when it does not.
- A scope lets two surfaces use the same plain key: J, K, R, S and E mean other
  things in a list than on the Comments tab. The registry test asks combos to be
  unique inside one scope and never to shadow a global one.
- **Family.** Entries that share a `family` (only the nine workspace digits
  today) render as one row, "Go to workspace 1 to 9" with ⌘1-9, while the
  registry keeps one entry per chord. A family is only for chords that do the
  same thing to a different index: the integration digits (⌘⌥1 to ⌘⌥6) open
  different lenses and keep a row each.
- **Shared rows.** Two chords that do the very same thing share one row
  (`SHARED_ROWS` in `shortcutRows.ts`): Show or hide Terminal lists ⌃\` and ⌘⌥T
  side by side, and each keeps its own Change and Reset.

## Keys a focused control owns

A few entries are keys a focused control answers, not global chords. They sit in
the registry so the list and the tooltips name them. The control that owns each
one handles its own key event and never registers it with the dispatcher.

| Keys                                                                                                                   | Owner and rule                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submit, ⌘↵ (`composer.submit`)                                                                                         | the one id behind every composer, editor and the workspace switcher; `isSubmitChord` keeps the lenient match that accepts Ctrl as well as ⌘                                                                                                               |
| ↵ `composer.send`, ⇧↵ `composer.newLine`                                                                               | the two message keys `PromptField` reads (docs/turns.md → One composer)                                                                                                                                                                                   |
| ⇧↵ Open the run of an activity row                                                                                     | the only combo without ⌘; the row matches through `eventMatches`                                                                                                                                                                                          |
| `list.next`, `list.previous`, `list.open`, `list.openInTool`, `list.reply`, `list.star`, `list.dismiss`, `list.search` | `useListKeys` matches them against the registry, so the rail hints, the Shortcuts page and the guide read the same entries; it keeps its own window listener because Enter must yield to a focused button (a row button of the list excepted)             |
| Select every fixable comment, ⌘A (`review.selectAll`)                                                                  | allowed ⌘A because the Branch page answers it only outside a text field                                                                                                                                                                                   |
| `selection.toggle`, `selection.all`, `selection.clear`, `selection.delete`                                             | `useSelectionKeys` matches the first, second and fourth; `SelectionBar` answers Esc through the escape stack; `selection.all` may use ⌘A because the hook yields to a text field                                                                          |
| Up one level, ⌘↑ (`nav.up`)                                                                                            | carries `yieldsToText`, so it may use a combo a text field owns                                                                                                                                                                                           |
| Back one crumb in a session, Esc (`nav.crumbUp`)                                                                       | the last rung of the one Esc ladder (`escapeLadder`), named so the Shortcuts page and the head back button's tooltip show it; the scoped Esc keys (`overlay.close`, `selection.clear`, `agent.stop`) answer first, which the registry test allows by name |
| ⇧F10 (`menu.open`)                                                                                                     | opens the context menu of the focused row, matched through `eventMatches`                                                                                                                                                                                 |

## A shortcut is taught where it is used

A control that has one shows it: as a pill on hover in dense rows, and as a
glyph in parentheses in tooltips. Where the row is too tight, the tooltip is the
only place it shows.

## Esc never leaves full screen on macOS

A full-screen window keeps its Space when Esc goes unhandled. The web layer still
gets every Escape keydown first, so popovers, the palette, drawers, studios and
inline edits close or cancel as usual; only the leftover key stops before AppKit.

1. `useKeepFullScreenOnEscape` arms a last window listener on every Escape
   keydown, after every in-app handler, and prevents the default so WebKit never
   hands the key back to the window.
2. As a second layer the window class (`src-tauri/src/fullscreen_escape.rs`)
   replaces `cancelOperation:`, `keyDown:` and `toggleFullScreen:`, keeping any
   original implementation for other keys, and drops an Esc in full screen.

Leave full screen with the green button, View > Exit Full Screen or Ctrl+⌘F.
