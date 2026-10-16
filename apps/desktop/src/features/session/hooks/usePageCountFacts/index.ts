import { useMemo } from 'react';
import type { Agent, Session } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../store';
import { selectOpenQuestions } from '../../components/SessionOverviewPane/lib';
import { selectResolverAgentIds } from '../../../review/selectResolverAgentIds';
import { isRunHeldForPlan } from '../../../../store/slices/workflows/workflowPlanApproval';
import { isStandaloneAgent } from '../../agent-kind';
import type { PageCountFacts } from '../../pageCountWord';

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
  const kindOverride = useAppStore((s) => s.agentKindOverride);

  return useMemo(() => {
    const resolvers = selectResolverAgentIds({ agents, kindOverride });
    const standalone = agents.filter(
      (agent) => isStandaloneAgent({ agent }) && !resolvers.has(agent.id),
    );
    const activeRunIds = new Set(
      agents.flatMap((agent) =>
        (agent.status === 'running' || agent.status === 'blocked') && agent.workflowRunId != null
          ? [agent.workflowRunId]
          : [],
      ),
    );
    const activeRuns = session.workflowRuns.filter(
      (run) => run.discardedAt == null && (activeRunIds.has(run.id) || isRunHeldForPlan({ run })),
    );
    const runs = session.workflowRuns.filter((run) => run.discardedAt == null);
    const orchestrated = runs.filter((run) => run.executionMode === 'dynamic');
    const runningOrchestrated = activeRuns.filter((run) => run.executionMode === 'dynamic');
    return {
      runs: runs.length - orchestrated.length,
      runningRuns: activeRuns.length - runningOrchestrated.length,
      orchestratedRuns: orchestrated.length,
      runningOrchestratedRuns: runningOrchestrated.length,
      agents: standalone.length,
      runningAgents: standalone.filter((agent) => agent.status === 'running').length,
      artifacts: Math.max(artifacts.length, plans.length),
      openQuestions: selectOpenQuestions(openQuestions).length,
    };
  }, [openQuestions, agents, kindOverride, session.workflowRuns, artifacts, plans]);
};
