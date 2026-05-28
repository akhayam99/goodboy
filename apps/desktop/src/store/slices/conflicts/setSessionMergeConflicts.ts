import type { SessionId } from '@goodboy/types';
import type { FileConflict } from '@goodboy/core';
import type { SetFn } from './types';

export function setSessionMergeConflicts(set: SetFn) {
  return (sessionId: SessionId, conflicts: ReadonlyArray<FileConflict>) => {
    set((state) => ({
      sessionMergeConflicts: { ...state.sessionMergeConflicts, [sessionId]: conflicts },
    }));
  };
}
