# Keyboard routing

> **Read this when** adding a contextual keyboard action or changing which
> operation owns a chord. **Not for** the user-facing shortcut overview
> ([features/keyboard.md](features/keyboard.md)).

Shortcuts register through the shared dispatcher. A contextual handler takes
precedence over the global handler for the same chord while its surface is
mounted, and unregistering it restores global handling. Undo and Redo yield
while a text field, editable surface or terminal owns input.

A key means the new thing of the place you are in. ⌘N is a new session
(`session.new`), except on the Chat page (`chat.newHere`, a new chat), on the
Terminal page (`terminal.newHere`, a new terminal) and inside the Ask panel
(`ask.reset`, Reset chat). Each contextual entry carries a `scope`, so the
registry binds a chord once per place, and a contextual handler that declines
(focus outside the Ask panel) hands the chord back to the global one. ⌘K is
the way to go anywhere: every global new and go-to is a palette entry, and the
Shortcuts page says so once.

On the Commits page, ⌘Z undoes the latest local edit and ⌘⇧Z redoes it.
The header controls advertise the same registry chords. Leaving the page
clears the edit stack and releases the handlers; its Git backup refs remain.
Busy edits consume neither a new operation nor a queued undo. The dispatcher
and the live history tests cover contextual precedence, text-field ownership,
page cleanup and both chords.
