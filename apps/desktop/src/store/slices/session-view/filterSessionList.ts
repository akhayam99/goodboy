import type { Session } from '@goodboy/types';

type ExemptParams = {
  readonly sessions: ReadonlyArray<Session>;
  readonly matched: ReadonlyArray<Session>;
  readonly exemptIds: ReadonlySet<string>;
};

export const withExemptSessions = ({
  sessions,
  matched,
  exemptIds,
}: ExemptParams): ReadonlyArray<Session> => {
  if (exemptIds.size === 0 || matched.length === sessions.length) {
    return matched;
  }
  const kept = new Set(matched.map((session) => session.id));
  return sessions.filter((session) => kept.has(session.id) || exemptIds.has(session.id));
};
