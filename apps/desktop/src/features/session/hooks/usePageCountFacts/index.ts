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
import { autoRootsOf } from '../../../auto/autoRootsOf';
import type { PageCountFacts } from '../../pageCountWord';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { isAutoTreeActive } from '../../../auto/autoTreePhases';

type Params = {
  readonly session: Session;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_AUTO_VIEWS: ReadonlyArray<AutoTreeView> = [];

type WorkingParams = {
  readonly agent: Agent;
  readonly autoViews: ReadonlyArray<AutoTreeView>;
};

const isAutoRootWorking = ({ agent, autoViews }: WorkingParams): boolean => {
  const view = autoViews.find((candidate) => candidate.tree.rootAgentId === agent.id);
  if (view === undefined) {
    return agent.status === 'running';
  }
  return isAutoTreeActive({ phase: view.tree.phase });
};

export const usePageCountFacts = ({ session }: Params): PageCountFacts => {
  const sessionId = session.id;
  const openQuestions = useSessionOpenQuestions(sessionId);
  const plans = useSessionPlans(sessionId);
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const kindOverride = useAppStore((s) => s.agentKindOverride);
  const autoViews = useAppStore((s) => s.autoTreeViews[sessionId] ?? NO_AUTO_VIEWS);

  return useMemo(() => {
    const resolvers = selectResolverAgentIds({ agents, kindOverride });
    const autoRoots = autoRootsOf({ agents, kindOverride });
    const autoRootIds = new Set(autoRoots.map((agent) => agent.id));
    const standalone = agents.filter(
      (agent) =>
        isStandaloneAgent({ agent }) && !resolvers.has(agent.id) && !autoRootIds.has(agent.id),
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
    return {
      runs: runs.length,
      runningRuns: activeRuns.length,
      agents: standalone.length,
      runningAgents: standalone.filter((agent) => agent.status === 'running').length,
      autoAgents: autoRoots.length,
      workingAutoAgents: autoRoots.filter((agent) => isAutoRootWorking({ agent, autoViews }))
        .length,
      artifacts: Math.max(artifacts.length, plans.length),
      openQuestions: selectOpenQuestions(openQuestions).length,
    };
  }, [openQuestions, agents, kindOverride, autoViews, session.workflowRuns, artifacts, plans]);
};
