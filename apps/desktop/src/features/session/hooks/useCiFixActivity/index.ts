import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { decodeCiFixKey, selectCiFixKeys } from '../../../../store/slices/agents/selectCiFixKeys';
import { selectCiFixUnloadedIds } from '../../../../store/slices/agents/selectCiFixUnloadedIds';
import type { JobActivityFacts } from '../../../../store/slices/history/jobFactsByAgentId';
import { ciFixProgressOf } from '../../../branch/checks/ciFixStages';

type Params = {
  readonly sessionId: SessionId;
};

const CI_FIX_TITLE = 'CI fix';

const NO_FACTS: ReadonlyMap<string, JobActivityFacts> = new Map();

export const useCiFixActivity = ({ sessionId }: Params): ReadonlyMap<string, JobActivityFacts> => {
  const keys = useAppStore(useShallow((state) => selectCiFixKeys({ state, sessionId })));
  const unloadedIds = useAppStore(
    useShallow((state) => selectCiFixUnloadedIds({ state, sessionId })),
  );
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const loadAgentTranscript = useAppStore((state) => state.loadAgentTranscript);
  const reportError = useAppStore((state) => state.reportError);
  useEffect(() => {
    for (const agentId of unloadedIds) {
      void loadAgentTranscript(sessionId, agentId, { isSelecting: false }).catch(
        (error: unknown) => {
          if (!isReportedError(error)) {
            void reportError({ title: "Couldn't read the CI fix", error, sessionId });
          }
        },
      );
    }
  }, [loadAgentTranscript, reportError, sessionId, unloadedIds]);
  return useMemo(() => {
    if (keys.length === 0) {
      return NO_FACTS;
    }
    const facts = new Map<string, JobActivityFacts>();
    for (const key of keys) {
      const decoded = decodeCiFixKey({ key });
      const agent = agents.find((candidate) => candidate.id === decoded?.agentId);
      if (decoded === null || agent === undefined) {
        continue;
      }
      const progress = decoded.isLatest
        ? ciFixProgressOf({
            chain: { state: decoded.chainState, isDismissed: decoded.isDismissed },
            isAnalysisFailed: decoded.isAnalysisFailed,
          })
        : {
            stages: [{ id: 'analyze' as const, label: 'Analyze', status: 'done' as const }],
            word: 'Replaced',
            phase: 'done' as const,
          };
      facts.set(agent.id, {
        kind: 'ci-fix',
        title: agent.name.startsWith(CI_FIX_TITLE) ? agent.name : CI_FIX_TITLE,
        word: progress.word,
        phase: progress.phase,
        isAutomatic: false,
        mountId: null,
        stages: progress.stages,
      });
    }
    return facts;
  }, [agents, keys]);
};
