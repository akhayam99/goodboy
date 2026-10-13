# Keyboard routing

> **Read this when** adding a contextual keyboard action or changing which
> operation owns a chord. **Not for** the user-facing shortcut overview
> ([features/keyboard.md](features/keyboard.md)).

Shortcuts register through the shared dispatcher. A contextual handler takes
precedence over the global handler for the same chord while its surface is
mounted, and unregistering it restores global handling. Undo and Redo yield
while a text field, editable surface or terminal owns input.

On the Commits page, ⌘Z undoes the latest local edit and ⌘⇧Z redoes it.
The header controls advertise the same registry chords. Leaving the page
clears the edit stack and releases the handlers; its Git backup refs remain.
Busy edits consume neither a new operation nor a queued undo. The dispatcher
and the live history tests cover contextual precedence, text-field ownership,
page cleanup and both chords.
