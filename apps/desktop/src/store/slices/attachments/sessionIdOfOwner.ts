import { brandId, type GoalAttachmentOwner, type SessionId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly owner: GoalAttachmentOwner;
};

export const sessionIdOfOwner = ({ get, owner }: Params): SessionId | null => {
  if (owner.type === 'session') {
    return brandId<SessionId>({ value: owner.id });
  }
  for (const session of get().sessions) {
    if (session.workflowRuns.some((run) => run.id === owner.id)) {
      return session.id;
    }
  }
  return null;
};
