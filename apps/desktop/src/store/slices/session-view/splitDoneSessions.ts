import type { Session, SessionId, SessionStage } from '@goodboy/types';
import { DONE_GROUP_KEY, DONE_GROUP_LABEL, type GroupedSessions } from './types';

type Params = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly stageBySession: Readonly<Record<SessionId, SessionStage>>;
  readonly exemptIds: ReadonlySet<string>;
};

type SessionParams = {
  readonly session: Session;
};

export const splitDoneSessions = ({
  groups,
  stageBySession,
  exemptIds,
}: Params): ReadonlyArray<GroupedSessions> => {
  if (groups.some((group) => group.key === DONE_GROUP_KEY)) {
    return groups;
  }
  const isDone = ({ session }: SessionParams): boolean =>
    stageBySession[session.id] === 'done' && !exemptIds.has(session.id);
  const done = groups.flatMap((group) => group.sessions.filter((session) => isDone({ session })));
  if (done.length === 0) {
    return groups;
  }
  const kept = groups
    .map((group) => ({
      ...group,
      sessions: group.sessions.filter((session) => !isDone({ session })),
    }))
    .filter((group) => group.sessions.length > 0);
  return [...kept, { key: DONE_GROUP_KEY, label: DONE_GROUP_LABEL, sessions: done }];
};
