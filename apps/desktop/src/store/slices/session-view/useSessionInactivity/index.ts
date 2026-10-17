import { useMemo, useRef } from 'react';
import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { inactiveWords } from '../inactiveWords';
import { inactivityInputsOf, type InactivityInputsState } from '../inactivityInputsOf';
import { sessionInactivityOf } from '../sessionInactivityOf';

export type SessionInactivityMap = {
  readonly since: ReadonlyMap<SessionId, number>;
  readonly labels: Readonly<Record<SessionId, string>>;
};

type Params = Omit<InactivityInputsState, 'agentDraft' | 'agentQueue'> & {
  readonly sessions: ReadonlyArray<Session>;
  readonly infos: Readonly<Record<SessionId, SessionStageInfo>>;
  readonly pinnedIds: ReadonlyArray<SessionId>;
  readonly currentSessionId: string | null;
};

const MINUTE_MS = 60_000;

type SignatureParams = {
  readonly map: SessionInactivityMap;
};

type Stable = {
  readonly signature: string;
  readonly map: SessionInactivityMap;
};

const signatureOf = ({ map }: SignatureParams): string =>
  [...map.since.entries()].map(([id, since]) => `${id}:${since}:${map.labels[id] ?? ''}`).join('|');

export const useSessionInactivity = ({
  sessions,
  infos,
  pinnedIds,
  currentSessionId,
  sessionPhaseRuns,
  sessionGithub,
  mountGithub,
  sessionGitlabMr,
  mountGitlabMr,
  sessionProjectMounts,
}: Params): SessionInactivityMap => {
  const agentDraft = useAppStore((s) => s.agentDraft);
  const agentQueue = useAppStore((s) => s.agentQueue);
  const now = useNow(MINUTE_MS);
  const next = useMemo((): SessionInactivityMap => {
    const pinned = new Set<SessionId>(pinnedIds);
    const state: InactivityInputsState = {
      sessionPhaseRuns,
      agentDraft,
      agentQueue,
      sessionGithub,
      mountGithub,
      sessionGitlabMr,
      mountGitlabMr,
      sessionProjectMounts,
    };
    const since = new Map<SessionId, number>();
    const labels: Record<SessionId, string> = {};
    for (const session of sessions) {
      const sessionId = session.id;
      const info = infos[sessionId];
      if (info === undefined) {
        continue;
      }
      const inactivity = sessionInactivityOf({
        session,
        info,
        now,
        isPinned: pinned.has(sessionId),
        isCurrent: currentSessionId === sessionId,
        ...inactivityInputsOf({ state, sessionId }),
      });
      if (!inactivity.isInactive || inactivity.lastActivityAt === null) {
        continue;
      }
      since.set(sessionId, inactivity.lastActivityAt);
      labels[sessionId] = inactiveWords({ lastActivityAt: inactivity.lastActivityAt, now });
    }
    return { since, labels };
  }, [
    sessions,
    infos,
    pinnedIds,
    currentSessionId,
    sessionPhaseRuns,
    agentDraft,
    agentQueue,
    sessionGithub,
    mountGithub,
    sessionGitlabMr,
    mountGitlabMr,
    sessionProjectMounts,
    now,
  ]);
  const stable = useRef<Stable | null>(null);
  const signature = signatureOf({ map: next });
  if (stable.current === null || stable.current.signature !== signature) {
    stable.current = { signature, map: next };
  }
  return stable.current.map;
};
