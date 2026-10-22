import { useMemo } from 'react';
import type { Agent, Session } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../store';
import { selectOpenQuestions } from '../../components/SessionOverviewPane/lib';
import type { PageCountFacts } from '../../pageCountWord';
import { liveArtifactCountOf } from '../../../artifacts/liveArtifactCountOf';
import { sessionRunCountsOf } from '../../sessionRunCountsOf';
import { useSessionRuns } from '../useSessionRuns';

type Params = {
  readonly session: Session;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const usePageCountFacts = ({ session }: Params): PageCountFacts => {
  const sessionId = session.id;
  const openQuestions = useSessionOpenQuestions(sessionId);
  const plans = useSessionPlans(sessionId);
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const changedFiles = useAppStore((s) => s.sessionFolderSummary[sessionId]?.counts.fileCount ?? 0);
  const runs = useSessionRuns({ session });

  return useMemo(() => {
    const counts = sessionRunCountsOf({ runs });
    return {
      changedFiles,
      runs: counts.runs,
      runningRuns: counts.runningRuns,
      waitingRuns: counts.waitingRuns,
      artifacts: liveArtifactCountOf({ plans, artifacts, agents }),
      openQuestions: selectOpenQuestions(openQuestions).length,
    };
  }, [changedFiles, openQuestions, agents, runs, artifacts, plans]);
};
