# Keyboard routing

> **Read this when** adding a contextual keyboard action or changing which
> operation owns a chord. **Not for** the user-facing shortcut overview
> ([features/keyboard.md](features/keyboard.md)).

Every chord is an entry of the shortcut registry (`shared/keyboard/registry.ts`,
with the window keys in `windowShortcuts.ts`) and runs through the shared
dispatcher.

## Contextual handlers

A contextual handler takes
precedence over the global handler for the same chord while its surface is
mounted, and unregistering it restores global handling. Undo and Redo yield
while a text field, editable surface or terminal owns input.

## Close and focus keys

⌘W (Close or go back) closes one level and never quits the app (⌘Q quits). On macOS the
File menu item Close (`app.close`) owns the chord and emits `goodboy://menu`
with that id (`app_menu.rs`); `useMenuCommands` replays it as the registry
shortcut, so the same dispatcher runs the press; elsewhere the chord is
Ctrl+Shift+W.

Each press closes one level: a popover or dialog, then the terminal tab (a
running process asks first), then the open drawer, then a studio, then the
session view up one page, and on its first page the session itself, which
closes to Home. It closes what you see: under a studio the session drawer is
parked, so the studio closes first and the drawer comes back with the session.
Home and the Board do nothing.
`terminal.closeTab` is the scoped entry that declines when a popover is open or
no tab is selected, so `app.close` takes the press.

⌘⇧W (`slot.close`, Ctrl+F4 elsewhere) closes the focused panel of the frame
(`closeSlot` reads `focusedShellPanelOf`): a tool of the grid or the detail.
With the page focused it closes the top of the side slot and nothing else: the
other half of the pair stays shown, a second press closes it, and with
no drawer shown (none open, or one parked under a studio) it does nothing.
F6 and ⇧F6 (`panel.focusNext`, `panel.focusPrevious`, kept with the two close
keys in `windowShortcuts.ts`) move the focus through page, detail and the
grid's panels and back to the page (`stepPanelFocus`). On macOS the
File menu item Close the panel owns the chord, so the press reaches the app
even when a terminal or a web page has the keyboard.

## New in place

A key means the new thing of the place you are in. ⌘N is a new session
(`session.new`), except on the Chat page (`chat.newHere`, a new chat), on the
Terminal page and the session terminal drawer (`terminal.newHere`, the New
terminal in picker: type to filter, arrows, Enter opens a tab, Esc closes; ⌘T
adds a tab in place with no picker), on the session Overview
(`overview.newHere`, the New menu of runs, agents and write-ups), inside the
Ask pane (`ask.reset`, New question) and on Workspaces (`home.newWorkspace`, New workspace). Each contextual entry carries a `scope`, so the
registry binds a chord once per place, and a contextual handler that declines
(focus outside the Ask pane) hands the chord back to the global one. ⌘K is
the way to go anywhere: every global new and go-to is an entry in Search or run, and the
Shortcuts page says so once.

## Undo

**Not now** on a Next suggestion adds no chord of its own: it is an `undoable` operation, so the global `app.undo` (⌘Z) restores it in stack order, and it yields to text fields like every undo.

On the Commits page, ⌘Z undoes the latest local edit and ⌘⇧Z redoes it.
The header controls advertise the same registry chords. Leaving the page
clears the edit stack and releases the handlers; its Git backup refs remain.
Busy edits consume neither a new operation nor a queued undo. The dispatcher
and the live history tests cover contextual precedence, text-field ownership,
page cleanup and both chords.
