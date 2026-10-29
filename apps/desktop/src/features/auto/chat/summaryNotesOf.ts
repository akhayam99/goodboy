import { stripOutcomeLine } from '@goodboy/core';
import type { NotesRole } from '../../chat/readingOrder/readingOrderOf';
import { summaryProseOf } from './summaryProseOf';

type Params = {
  readonly summary: string | null;
  readonly key: string;
  readonly isOpen: boolean;
};

export const summaryNotesOf = ({ summary, key, isOpen }: Params): NotesRole | null => {
  const prose = summaryProseOf({
    summary: summary === null ? null : stripOutcomeLine({ text: summary }),
  });
  if (prose === null) {
    return null;
  }
  return {
    kind: 'notes',
    notes: [{ key, text: prose }],
    lineCount: prose.split('\n').filter((line) => line.trim() !== '').length,
    isOpen,
  };
};
