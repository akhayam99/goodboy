import { useMemo } from 'react';
import type { Agent, Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../store';
import { useResolveQueueRows } from '../../../resolve/hooks/useResolveQueueRows';
import { conversationsWaiting } from '../../../resolve/conversationsWaiting';
import { selectOpenQuestions } from '../../components/SessionOverviewPane/lib';
import { selectResolverAgentIds } from '../../../review/selectResolverAgentIds';
import { isStandaloneAgent } from '../../agent-kind';
import {
  COUNTED_PAGE_IDS,
  pageCountWordOf,
  type PageCountFacts,
  type PageSummaries,
} from '../../pageCountWord';

type Params = {
  readonly session: Session;
};

const summariesOf = ({ facts }: { readonly facts: PageCountFacts }): PageSummaries =>
  Object.fromEntries(
    COUNTED_PAGE_IDS.flatMap((page) => {
      const word = pageCountWordOf({ page, facts });
      return word === null ? [] : [[page, word] as const];
    }),
  );

export const usePageSummaries = ({ session }: Params): PageSummaries => {
  const sessionId = session.id as SessionId;
  const rows = useResolveQueueRows({ sessionId });
  const openQuestions = useSessionOpenQuestions(sessionId);
  const plans = useSessionPlans(sessionId);
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const kindOverride = useAppStore((s) => s.agentKindOverride);

  return useMemo(() => {
    const resolvers = selectResolverAgentIds({ agents, kindOverride });
    const standalone = agents.filter(
      (agent) => isStandaloneAgent({ agent }) && !resolvers.has(agent.id),
    );
    const liveRuns = session.workflowRuns.filter((run) => run.discardedAt == null);
    const runningRunIds = new Set(
      agents.flatMap((agent) =>
        agent.status === 'running' && agent.workflowRunId != null ? [agent.workflowRunId] : [],
      ),
    );
    return summariesOf({
      facts: {
        waiting: conversationsWaiting({ rows }),
        mounts: mounts.length,
        runs: liveRuns.length,
        runningRuns: liveRuns.filter((run) => runningRunIds.has(run.id)).length,
        agents: standalone.length,
        runningAgents: standalone.filter((agent) => agent.status === 'running').length,
        artifacts: Math.max(artifacts.length, plans.length),
        openQuestions: selectOpenQuestions(openQuestions).length,
      },
    });
  }, [rows, openQuestions, agents, kindOverride, session.workflowRuns, artifacts, plans, mounts]);
};
