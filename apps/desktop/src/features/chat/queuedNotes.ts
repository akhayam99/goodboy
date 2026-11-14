import type { QueuedRow } from './components/ChatInput/queuedRowsOf';

export type QueuedNotes = Readonly<{
  rows: ReadonlyArray<QueuedRow>;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}>;
