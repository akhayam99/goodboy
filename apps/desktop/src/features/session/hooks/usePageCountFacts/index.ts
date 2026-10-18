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
import { isStandaloneAgent } from '../../agent-kind';
import { autoRootsOf } from '../../../auto/autoRootsOf';
import type { PageCountFacts } from '../../pageCountWord';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { isAutoTreeActive } from '../../../auto/autoTreePhases';
import { liveArtifactCountOf } from '../../../artifacts/liveArtifactCountOf';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { splitWorkflowRuns } from '../../../workflows/activeWorkflowRuns';
import { runRowFactsOf } from '../../../workflows/runRowFactsOf';

type Params = {
  readonly session: Session;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_AUTO_VIEWS: ReadonlyArray<AutoTreeView> = [];

const RUNNING_DOTS: ReadonlySet<string> = new Set(['running']);

const WAITING_DOTS: ReadonlySet<string> = new Set(['needsYou', 'failed']);

type CountDotsParams = {
  readonly isOrchestrated: boolean;
  readonly shown: ReadonlySet<string>;
};

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
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const orchestrating = useAppStore((s) => s.orchestratingWorkflowRuns);
  const changedFiles = useAppStore((s) => s.sessionFolderSummary[sessionId]?.counts.fileCount ?? 0);

  return useMemo(() => {
    const resolvers = selectResolverAgentIds({ agents, kindOverride });
    const autoRoots = autoRootsOf({ agents, kindOverride });
    const autoRootIds = new Set(autoRoots.map((agent) => agent.id));
    const standalone = agents.filter(
      (agent) =>
        isStandaloneAgent({ agent }) && !resolvers.has(agent.id) && !autoRootIds.has(agent.id),
    );
    const { agentsByRunId } = splitWorkflowRuns({ attachedRuns, agents });
    const liveRuns = attachedRuns.filter(({ run }) => run.discardedAt == null);
    const dots = liveRuns.map(({ run, workflow }) => ({
      isOrchestrated: run.executionMode === 'dynamic',
      dot: runRowFactsOf({
        run,
        workflow,
        agents: agentsByRunId.get(run.id) ?? NO_AGENTS,
        predecessorName: '',
        isOrchestrating: orchestrating?.[run.id] ?? false,
        questions: openQuestions,
      }).dot,
    }));
    const countDots = ({ isOrchestrated, shown }: CountDotsParams): number =>
      dots.filter((entry) => entry.isOrchestrated === isOrchestrated && shown.has(entry.dot))
        .length;
    const runs = session.workflowRuns.filter((run) => run.discardedAt == null);
    const orchestrated = runs.filter((run) => run.executionMode === 'dynamic');
    return {
      changedFiles,
      runs: runs.length - orchestrated.length,
      runningRuns: countDots({ isOrchestrated: false, shown: RUNNING_DOTS }),
      waitingRuns: countDots({ isOrchestrated: false, shown: WAITING_DOTS }),
      orchestratedRuns: orchestrated.length,
      runningOrchestratedRuns: countDots({ isOrchestrated: true, shown: RUNNING_DOTS }),
      waitingOrchestratedRuns: countDots({ isOrchestrated: true, shown: WAITING_DOTS }),
      agents: standalone.length,
      runningAgents: standalone.filter((agent) => agent.status === 'running').length,
      autoAgents: autoRoots.length,
      workingAutoAgents: autoRoots.filter((agent) => isAutoRootWorking({ agent, autoViews }))
        .length,
      artifacts: liveArtifactCountOf({ plans, artifacts, agents }),
      openQuestions: selectOpenQuestions(openQuestions).length,
    };
  }, [
    changedFiles,
    openQuestions,
    agents,
    kindOverride,
    autoViews,
    session.workflowRuns,
    artifacts,
    plans,
    attachedRuns,
    orchestrating,
  ]);
};
