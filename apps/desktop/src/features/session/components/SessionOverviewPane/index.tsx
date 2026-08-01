import { useEffect, useMemo } from 'react';
import { Divider, Eyebrow, ScrollFade } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import {
  agentHasUnread,
  EMPTY_ARRAY,
  useAppStore,
  useCurrentWorkspace,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionStageInfo,
  useSessionUnreadLens,
} from '../../../../store';
import type { LensKind } from '../../../../store';
import { useWorkspaceRuns } from '../../../orchestration/hooks/useWorkspaceRuns';
import { classifyAgent, selectStandaloneAgents } from '../../agent-kind';
import { useResolvableCount } from '../../hooks/useResolvableCount';
import { selectOpenQuestions } from './lib';
import { selectNextUp, type NextUpItem, type StalledStep, type WaitingAgent } from './selectNextUp';
import { ActivitySection } from './ActivitySection';
import { HeaderBand } from './HeaderBand';
import { LinkedWorkSection } from './LinkedWorkSection';
import { NextUpCard } from './NextUpCard';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const SessionOverviewPane = ({ session, onSelectLens }: Props) => {
  const sessionId = session.id as SessionId;
  const stage = useSessionStageInfo(session);
  const workspace = useCurrentWorkspace();
  const sessionList = useMemo(() => [session], [session]);
  const runs = useWorkspaceRuns(session.workspaceId, sessionList);
  const pullRequest = useAppStore((s) => s.sessionGithub[sessionId]?.pr ?? null);
  const openQuestions = selectOpenQuestions(useSessionOpenQuestions(session.id));
  const sessionAgents = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const rawStandalone = selectStandaloneAgents(sessionAgents);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const nonResolverAgents = useNonResolverStandaloneAgents(sessionId);
  const unreadLens = useSessionUnreadLens(sessionId);
  const resolvable = useResolvableCount(sessionId);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const loadPendingResolutions = useAppStore((s) => s.loadPendingResolutions);

  useEffect(() => {
    void loadPendingResolutions(sessionId);
  }, [sessionId, loadPendingResolutions]);

  const activeRuns = session.workflowRuns.filter((run) => run.discardedAt == null);
  const isFresh = activeRuns.length === 0 && rawStandalone.length === 0;
  const resolveCount =
    resolvable.prComments +
    resolvable.diffComments +
    resolvable.pending +
    runs.resolveQueue.length +
    (runs.completedResolveQueue?.length ?? 0);
  const questionBlocksRun = openQuestions.some(
    (question) =>
      question.workflowRunId != null && activeRuns.some((run) => run.id === question.workflowRunId),
  );

  const pickAgentId = ({
    candidates,
  }: {
    readonly candidates: ReadonlyArray<Agent>;
  }): string | null => {
    const needsAttention =
      candidates.find((agent) => agentHasUnread(agent, false)) ??
      candidates.find((agent) => agent.status === 'failed') ??
      candidates.find((agent) => agent.status === 'running');
    return (needsAttention ?? candidates[0])?.id ?? null;
  };

  const waitingItemId = ({ lens }: { readonly lens: LensKind }): string | null => {
    if (lens === 'agents') {
      return pickAgentId({ candidates: nonResolverAgents });
    }
    if (lens === 'resolve') {
      return pickAgentId({
        candidates: rawStandalone.filter(
          (agent) => classifyAgent(agent, agentKindOverride[agent.id] ?? null) === 'resolver',
        ),
      });
    }
    if (lens === 'workflows') {
      return activeRuns[activeRuns.length - 1]?.id ?? null;
    }
    return null;
  };

  const waiting: WaitingAgent | null =
    unreadLens === null
      ? null
      : {
          lens: unreadLens,
          agentId: waitingItemId({ lens: unreadLens }),
          isResolver: unreadLens === 'resolve',
        };

  const stalledStep = useMemo((): StalledStep | null => {
    for (const lane of runs.lanes) {
      const step = lane.steps.find((candidate) => candidate.status === 'stalled');
      if (step == null) {
        continue;
      }
      return { runId: lane.runId, name: step.name };
    }
    return null;
  }, [runs.lanes]);

  const runningAgentId = useMemo((): string | null => {
    const running = sessionAgents.filter((agent) => agent.status === 'running');
    if (running.length === 0) {
      return null;
    }
    return running.reduce((latest, agent) => (agent.ordinal > latest.ordinal ? agent : latest)).id;
  }, [sessionAgents]);

  const nextUp = selectNextUp({
    openQuestions,
    questionBlocksRun,
    pr: pullRequest,
    waiting,
    stalledStep,
    sessionStateKind: session.state.kind,
    isFresh,
    runningAgentId,
    resolveCount,
  });

  const openWorkflowBuilder = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  const actOnNextUp = ({ item }: { readonly item: NextUpItem }) => {
    if (item.lens === null) {
      openWorkflowBuilder();
      return;
    }
    if (item.lens === 'workflows' && item.itemId != null) {
      setFocusedWorkflowRun(sessionId, item.itemId);
      onSelectLens('workflows');
      return;
    }
    if (item.itemId != null && (item.lens === 'agents' || item.lens === 'resolve')) {
      onSelectLens(item.lens);
      void selectAgent(sessionId, item.itemId as AgentId);
      return;
    }
    onSelectLens(item.lens);
  };

  return (
    <ScrollFade className="h-full" viewportClassName="px-8 py-7" fadeSize={24}>
      <div className="animate-fade-in mx-auto flex max-w-5xl flex-col gap-6">
        <HeaderBand session={session} stage={stage} />
        <Divider />
        <section aria-label="Next up" className="flex flex-col gap-2">
          <Eyebrow label="Next up" muted className="px-0.5 font-medium" />
          {nextUp !== null ? (
            <NextUpCard item={nextUp} onAct={() => actOnNextUp({ item: nextUp })} />
          ) : (
            <p className="rounded-lg bg-muted/20 px-3.5 py-2.5 text-sm text-muted-foreground">
              Nothing needs you right now.
            </p>
          )}
        </section>
        <Divider />
        <LinkedWorkSection sessionId={sessionId} onSelectLens={onSelectLens} />
        <Divider />
        <ActivitySection
          session={session}
          workspaceId={workspace?.id ?? null}
          runs={runs}
          isFresh={isFresh}
          resolveCount={resolveCount}
          onOpenWorkflowBuilder={openWorkflowBuilder}
          onSelectLens={onSelectLens}
        />
      </div>
    </ScrollFade>
  );
};
