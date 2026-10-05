import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useBranchNotes } from '../../../resolve/notes/useBranchNotes';
import { noteFixesOf, type NoteFix } from '../../lib/noteFixes';

type Params = {
  readonly sessionId: SessionId;
};

export const useNoteFixes = ({ sessionId }: Params): ReadonlyArray<NoteFix> => {
  const { onBranch: notes } = useBranchNotes({ sessionId });
  const entries = useAppStore((s) => s.sessionResolveQueueItems[sessionId] ?? EMPTY_ARRAY);
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ARRAY);
  return useMemo(() => noteFixesOf({ notes, entries, attempts }), [attempts, entries, notes]);
};
