import type { Session, SessionId } from '@goodboy/types';
import { INACTIVE_GROUP_KEY, INACTIVE_GROUP_LABEL, type GroupedSessions } from './types';

type Params = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly inactiveSince: ReadonlyMap<SessionId, number>;
};

export const splitInactiveSessions = ({
  groups,
  inactiveSince,
}: Params): ReadonlyArray<GroupedSessions> => {
  const isInactive = (session: Session): boolean => inactiveSince.has(session.id);
  const inactive = groups.flatMap((group) => group.sessions.filter(isInactive));
  if (inactive.length === 0) {
    return groups;
  }
  const sinceOf = (session: Session): number => inactiveSince.get(session.id) ?? 0;
  const kept = groups
    .map((group) => ({
      ...group,
      sessions: group.sessions.filter((session) => !isInactive(session)),
    }))
    .filter((group) => group.sessions.length > 0);
  return [
    ...kept,
    {
      key: INACTIVE_GROUP_KEY,
      label: INACTIVE_GROUP_LABEL,
      sessions: [...inactive].sort((a, b) => sinceOf(b) - sinceOf(a) || a.id.localeCompare(b.id)),
    },
  ];
};
