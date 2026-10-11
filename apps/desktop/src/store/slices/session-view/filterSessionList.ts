import type { Session, SessionStage } from '@goodboy/types';

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

type StatusParams = {
  readonly sessions: ReadonlyArray<Session>;
  readonly statusFilter: ReadonlyArray<SessionStage>;
  readonly stageBySession: Readonly<Record<string, SessionStage>>;
  readonly exemptIds: ReadonlySet<string>;
};

export const filterSessionsByStatus = ({
  sessions,
  statusFilter,
  stageBySession,
  exemptIds,
}: StatusParams): ReadonlyArray<Session> => {
  if (statusFilter.length === 0) {
    return sessions;
  }
  return sessions.filter((session) => {
    if (exemptIds.has(session.id)) {
      return true;
    }
    const stage = stageBySession[session.id];
    return stage !== undefined && statusFilter.includes(stage);
  });
};
