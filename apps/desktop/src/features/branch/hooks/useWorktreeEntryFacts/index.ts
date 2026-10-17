import { useSyncExternalStore } from 'react';
import type { SessionId } from '@goodboy/types';
import type { WorktreeEntryFacts } from '../../worktreeEntryFacts';
import { worktreeEntryFactsBus } from '../../worktreeEntryFactsBus';

type Params = {
  readonly sessionId: SessionId;
};

export const useWorktreeEntryFacts = ({ sessionId }: Params): WorktreeEntryFacts | null => {
  const published = useSyncExternalStore(
    worktreeEntryFactsBus.subscribe,
    worktreeEntryFactsBus.get,
    () => null,
  );
  return published === null || published.sessionId !== sessionId ? null : published.facts;
};
