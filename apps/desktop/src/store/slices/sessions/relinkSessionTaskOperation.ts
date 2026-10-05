import type { SessionEventPayload, SessionId } from '@goodboy/types';
import { replaceTaskLinks } from './replaceTaskLinks';
import type { SliceDeps } from '../../slice-types';

type RelinkParams = {
  readonly sessionId: SessionId;
  readonly operation: NonNullable<SessionEventPayload['taskOperation']>;
};

export const relinkSessionTaskOperation = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, operation }: RelinkParams): Promise<boolean> => {
    const pending = get().undoStack.find((candidate) => candidate.id === operation.id);
    if (pending !== undefined) {
      return get().undoLastOperation({ id: operation.id, shouldAnnounce: false });
    }
    const task = operation.before[0];
    if (task === undefined || task.sessionId !== sessionId) {
      return false;
    }
    return replaceTaskLinks({
      set,
      get,
      sessionId,
      task,
      expected: operation.after,
      next: operation.before,
    });
  };
};
