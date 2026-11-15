import type { QueuedNotes } from './queuedNotes';

const ignoreNote = () => undefined;

export const EMPTY_QUEUED_NOTES: QueuedNotes = {
  rows: [],
  onEdit: ignoreNote,
  onRemove: ignoreNote,
};
