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
  const { sessions, archivedSessions } = get();
  const owning = [...sessions, ...Object.values(archivedSessions).flat()].find((session) =>
    session.workflowRuns.some((run) => run.id === owner.id),
  );
  return owning?.id ?? null;
};
