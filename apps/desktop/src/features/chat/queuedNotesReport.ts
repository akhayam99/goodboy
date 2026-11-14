import { createContext } from 'react';
import type { QueuedNotes } from './queuedNotes';

export const QueuedNotesReportContext = createContext<((queued: QueuedNotes) => void) | null>(null);
