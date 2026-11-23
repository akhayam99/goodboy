import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { Work } from '../../../../live-state/workOf';
import { AGENT_KIND_META, classifyAgent } from '../../../../session/agent-kind';

type Params = {
  readonly work: ReadonlyArray<Work>;
  readonly sessions: ReadonlyArray<Session>;
};

export const useAgentNouns = ({ work, sessions }: Params): ReadonlyMap<string, string> => {
  const wanted = useMemo(
    () => new Set(work.flatMap((item) => (item.agentId === null ? [] : [item.agentId]))),
    [work],
  );
  const live = useMemo(() => {
    const ids = new Set(work.map((item) => item.sessionId));
    return sessions.filter((session) => ids.has(session.id));
  }, [sessions, work]);
  const nouns = useAppStore(
    useShallow((state) => {
      const picked: Record<string, string> = {};
      for (const session of live) {
        for (const agent of state.sessionPhaseRuns[session.id] ?? []) {
          if (wanted.has(agent.id)) {
            const override = state.agentKindOverride[agent.id] ?? null;
            picked[agent.id] = AGENT_KIND_META[classifyAgent({ agent, override })].noun;
          }
        }
      }
      return picked;
    }),
  );
  return useMemo(() => new Map(Object.entries(nouns)), [nouns]);
};
