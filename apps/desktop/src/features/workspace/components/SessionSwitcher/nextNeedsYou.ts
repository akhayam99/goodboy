import type {
  Session,
  SessionAttentionReason,
  SessionId,
  SessionStage,
  SessionViewPrefs,
} from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import { sessionMatchesProjectFilter } from '../../../../store/slices/sessionFilters/sessionMatchesProjectFilter';
import { sortAndGroupSessions } from '../../../../store/slices/session-view/sortAndGroupSessions';
import { stageInfoOf } from '../../../../store/slices/session-view/stageInfoOf';

type Params = {
  readonly state: AppStore;
};

export type NeedsYouTarget = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
  readonly isOnlyOne: boolean;
  readonly isOutsideFilter: boolean;
};

type OrderParams = {
  readonly sessions: ReadonlyArray<Session>;
  readonly prefs: SessionViewPrefs;
  readonly stageBySession: Readonly<Record<SessionId, SessionStage>>;
  readonly attentionSinceBySession: Readonly<Record<SessionId, number | null | undefined>>;
};

const orderOf = ({
  sessions,
  prefs,
  stageBySession,
  attentionSinceBySession,
}: OrderParams): ReadonlyArray<Session> => {
  const [first] = sortAndGroupSessions({
    sessions,
    prefs: { ...prefs, group: 'none' },
    githubState: {},
    stageBySession,
    attentionSinceBySession,
  });
  return first?.sessions ?? [];
};

export const nextNeedsYou = ({ state }: Params): NeedsYouTarget | null => {
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null) {
    return null;
  }
  const selectedProjectIds = state.selectedProjectIds[workspaceId] ?? [];
  const reasons = new Map<SessionId, SessionAttentionReason | null>();
  const stageBySession: Record<SessionId, SessionStage> = {};
  const attentionSinceBySession: Record<SessionId, number | null | undefined> = {};
  const inside: Session[] = [];
  const outside: Session[] = [];
  for (const session of state.sessions) {
    const info = stageInfoOf(state, session);
    if (info.stage !== 'attention') {
      continue;
    }
    reasons.set(session.id, info.attention);
    stageBySession[session.id] = info.stage;
    attentionSinceBySession[session.id] = info.attentionSince;
    const mounts = state.sessionProjectMounts[session.id] ?? [];
    (sessionMatchesProjectFilter({ mounts, selectedProjectIds }) ? inside : outside).push(session);
  }
  const prefs = state.getSessionViewPrefs(workspaceId);
  const order = { prefs, stageBySession, attentionSinceBySession };
  const ordered = [
    ...orderOf({ sessions: inside, ...order }),
    ...orderOf({ sessions: outside, ...order }),
  ];
  if (ordered.length === 0) {
    return null;
  }
  const currentIndex = ordered.findIndex((session) => session.id === state.currentSessionId);
  const target = ordered[(currentIndex + 1) % ordered.length];
  if (target === undefined) {
    return null;
  }
  return {
    sessionId: target.id,
    reason: reasons.get(target.id) ?? null,
    isOnlyOne: ordered.length === 1 && currentIndex === 0,
    isOutsideFilter: outside.includes(target),
  };
};
