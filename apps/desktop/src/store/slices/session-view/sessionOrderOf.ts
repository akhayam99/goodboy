import type { Session, SessionId, SessionStage, SessionStageInfo } from '@goodboy/types';
import { attentionCountOf, type AttentionCount } from './attentionCountOf';
import { sortAndGroupSessions } from './sortAndGroupSessions';
import { DEFAULT_PREFS, PINNED_GROUP_KEY, VALID_STAGES } from './types';

type SessionStateGroup = {
  readonly key: typeof PINNED_GROUP_KEY | SessionStage;
  readonly sessions: ReadonlyArray<Session>;
  readonly count: number;
};

export type SessionOrder = {
  readonly groups: ReadonlyArray<SessionStateGroup>;
  readonly order: ReadonlyArray<SessionId>;
  readonly needsYou: AttentionCount;
};

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly pinnedIds: ReadonlyArray<SessionId>;
  readonly infos: Readonly<Record<SessionId, SessionStageInfo>>;
  readonly lastTurnBySession: Readonly<Record<string, string>>;
};

const WALKED_STAGES = VALID_STAGES.filter((stage) => stage !== 'done');

export const sessionOrderOf = ({
  sessions,
  pinnedIds,
  infos,
  lastTurnBySession,
}: Params): SessionOrder => {
  const needsYou = attentionCountOf({
    items: sessions.flatMap((session) => {
      const info = infos[session.id];
      return info === undefined ? [] : [{ id: session.id, info }];
    }),
  });
  const pinnedSet = new Set<string>(pinnedIds);
  const pinned = pinnedIds.flatMap((id) => sessions.filter((session) => session.id === id));
  const rest = sessions.filter((session) => !pinnedSet.has(session.id));
  const stageBySession: Record<SessionId, SessionStage> = {};
  const attentionSinceBySession: Record<SessionId, number | null | undefined> = {};
  for (const session of rest) {
    const info = infos[session.id];
    if (info === undefined) {
      continue;
    }
    stageBySession[session.id] = info.stage;
    attentionSinceBySession[session.id] = info.attentionSince;
  }
  const grouped = sortAndGroupSessions({
    sessions: rest,
    prefs: { ...DEFAULT_PREFS, group: 'stage' },
    githubState: {},
    stageBySession,
    lastTurnBySession,
    attentionSinceBySession,
  });
  const byState = WALKED_STAGES.flatMap((stage): ReadonlyArray<SessionStateGroup> => {
    const found = grouped.find((group) => group.key === stage);
    if (found === undefined) {
      return [];
    }
    const count = stage === 'attention' ? needsYou.count : found.sessions.length;
    return [{ key: stage, sessions: found.sessions, count }];
  });
  const groups: ReadonlyArray<SessionStateGroup> =
    pinned.length === 0
      ? byState
      : [{ key: PINNED_GROUP_KEY, sessions: pinned, count: pinned.length }, ...byState];
  return {
    groups,
    order: groups.flatMap((group) => group.sessions.map((session) => session.id)),
    needsYou,
  };
};
