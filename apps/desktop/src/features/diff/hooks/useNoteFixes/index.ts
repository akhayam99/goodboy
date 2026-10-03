import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useDiffComments } from '../../../../store';
import { noteFixesOf, type NoteFix } from '../../lib/noteFixes';

type Params = {
  readonly sessionId: SessionId;
};

export const useNoteFixes = ({ sessionId }: Params): ReadonlyArray<NoteFix> => {
  const notes = useDiffComments(sessionId);
  const entries = useAppStore((s) => s.sessionResolveQueueItems[sessionId] ?? EMPTY_ARRAY);
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ARRAY);
  return useMemo(() => noteFixesOf({ notes, entries, attempts }), [attempts, entries, notes]);
};
