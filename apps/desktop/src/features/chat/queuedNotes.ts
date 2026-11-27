import type { QueuedRow } from './queuedMessages/queuedRow';

export type QueuedNotes = Readonly<{
  rows: ReadonlyArray<QueuedRow>;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}>;
