import type { SessionAttentionReason, SessionId, SessionStage } from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import { sessionMatchesProjectFilter } from '../../../../store/slices/sessionFilters/sessionMatchesProjectFilter';
import { sortAndGroupSessions } from '../../../../store/slices/session-view/sortAndGroupSessions';
import { stageInfoOf } from '../../../../store/slices/session-view/stageInfoOf';

type Params = {
  readonly state: AppStore;
};

type NeedsYouTarget = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

export const nextNeedsYou = ({ state }: Params): NeedsYouTarget | null => {
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null) {
    return null;
  }
  const selectedProjectIds = state.selectedProjectIds[workspaceId] ?? [];
  const reasons = new Map<SessionId, SessionAttentionReason | null>();
  const stageBySession: Record<SessionId, SessionStage> = {};
  const waiting = state.sessions.filter((session) => {
    const mounts = state.sessionProjectMounts[session.id] ?? [];
    if (!sessionMatchesProjectFilter({ mounts, selectedProjectIds })) {
      return false;
    }
    const info = stageInfoOf(state, session);
    reasons.set(session.id as SessionId, info.attention);
    stageBySession[session.id as SessionId] = info.stage;
    return info.stage === 'attention';
  });
  const [first] = sortAndGroupSessions({
    sessions: waiting,
    prefs: { ...state.getSessionViewPrefs(workspaceId), group: 'none' },
    githubState: {},
    stageBySession,
  });
  const ordered = first?.sessions ?? [];
  if (ordered.length === 0) {
    return null;
  }
  const currentIndex = ordered.findIndex((session) => session.id === state.currentSessionId);
  const target = ordered[(currentIndex + 1) % ordered.length];
  if (target === undefined) {
    return null;
  }
  const sessionId = target.id as SessionId;
  return { sessionId, reason: reasons.get(sessionId) ?? null };
};
