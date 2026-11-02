import type { SessionId } from '@goodboy/types';

type Params = {
  readonly previous: ReadonlyMap<SessionId, string>;
  readonly next: ReadonlyMap<SessionId, string>;
};

export const changedBranchSessions = ({ previous, next }: Params): ReadonlyArray<SessionId> => {
  const changed: Array<SessionId> = [];
  for (const [sessionId, branch] of next) {
    if (previous.get(sessionId) !== branch) {
      changed.push(sessionId);
    }
  }
  return changed;
};
