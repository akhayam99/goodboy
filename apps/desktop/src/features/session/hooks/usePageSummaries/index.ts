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
import type { PageSummaries } from '../../trail/menus/pageMenu';

type Params = {
  readonly session: Session;
};

const plural = ({ count, noun }: { readonly count: number; readonly noun: string }) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

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
    const waiting = conversationsWaiting({ rows });
    const questions = selectOpenQuestions(openQuestions).length;
    const resolvers = selectResolverAgentIds({ agents, kindOverride });
    const standalone = agents.filter(
      (agent) => isStandaloneAgent({ agent }) && !resolvers.has(agent.id),
    );
    const runningAgents = standalone.filter((agent) => agent.status === 'running').length;
    const liveRuns = session.workflowRuns.filter((run) => run.discardedAt == null).length;
    const artifactCount = Math.max(artifacts.length, plans.length);
    const summaries: PageSummaries = {
      ...(waiting > 0 && { review: `${waiting} need you` }),
      ...(questions > 0 && { questions: `${questions} open` }),
      ...(runningAgents > 0
        ? { agents: `${runningAgents} running` }
        : standalone.length > 0 && { agents: plural({ count: standalone.length, noun: 'agent' }) }),
      ...(liveRuns > 0 && { workflows: plural({ count: liveRuns, noun: 'run' }) }),
      ...(artifactCount > 0 && { plans: String(artifactCount) }),
      ...(mounts.length > 1 && {
        files: `${mounts.length} branches`,
      }),
    };
    return summaries;
  }, [rows, openQuestions, agents, kindOverride, session.workflowRuns, artifacts, plans, mounts]);
};
