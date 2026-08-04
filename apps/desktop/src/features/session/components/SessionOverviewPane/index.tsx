import { useEffect, useMemo } from 'react';
import { Divider, Eyebrow, ScrollFade, cn } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import {
  agentHasUnread,
  EMPTY_ARRAY,
  useAppStore,
  useCurrentWorkspace,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionStageInfo,
} from '../../../../store';
import type { LensKind } from '../../../../store';
import { useWorkspaceRuns } from '../../../orchestration/hooks/useWorkspaceRuns';
import {
  agentHomeLens,
  classifyAgent,
  resolveRootAgent,
  selectStandaloneAgents,
  type AgentHomeLens,
} from '../../agent-kind';
import { useResolvableCount } from '../../hooks/useResolvableCount';
import { selectOpenQuestions } from './lib';
import {
  selectNextUp,
  type NextUpItem,
  type RunningAgent,
  type StalledStep,
  type WaitingAgent,
} from './selectNextUp';
import { ActivitySection } from './ActivitySection';
import { HeaderBand } from './HeaderBand';
import { LinkedWorkSection } from './LinkedWorkSection';
import { NextUpCard } from './NextUpCard';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { LensEmptyState } from '../../../../shared/components/LensEmptyState';
import { PANE_RHYTHM } from '../../../../shared/components/paneRhythm';

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

  const unreadRoot = useMemo((): Agent | null => {
    let newest: Agent | null = null;
    for (const agent of sessionAgents) {
      if (agent.status === 'failed') {
        continue;
      }
      if (!agentHasUnread(agent, false)) {
        continue;
      }
      if (newest != null && (agent.lastFinishedAt ?? '') <= (newest.lastFinishedAt ?? '')) {
        continue;
      }
      newest = agent;
    }
    if (newest == null) {
      return null;
    }
    return resolveRootAgent({ agents: sessionAgents, agentId: newest.id as AgentId });
  }, [sessionAgents]);

  const waitingItemId = ({ lens }: { readonly lens: AgentHomeLens }): string | null => {
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
    return unreadRoot?.workflowRunId ?? null;
  };

  const unreadLens: AgentHomeLens | null =
    unreadRoot === null
      ? null
      : agentHomeLens(
          unreadRoot,
          classifyAgent(unreadRoot, agentKindOverride[unreadRoot.id] ?? null),
        );

  const waiting: WaitingAgent | null =
    unreadLens === null
      ? null
      : {
          lens: unreadLens,
          agentId: waitingItemId({ lens: unreadLens }),
          isResolver: unreadLens === 'resolve',
        };

  const stalledStep = useMemo((): StalledStep | null => {
    for (const lane of [...runs.lanes, ...(runs.completedLanes ?? [])]) {
      const step = lane.steps.find((candidate) => candidate.status === 'stalled');
      if (step == null) {
        continue;
      }
      return { runId: lane.runId, name: step.name };
    }
    return null;
  }, [runs.lanes, runs.completedLanes]);

  const runningAgent = useMemo((): RunningAgent | null => {
    const running = sessionAgents.filter((agent) => agent.status === 'running');
    if (running.length === 0) {
      return null;
    }
    const latest = running.reduce((best, agent) => (agent.ordinal > best.ordinal ? agent : best));
    const root =
      resolveRootAgent({ agents: sessionAgents, agentId: latest.id as AgentId }) ?? latest;
    const lens = agentHomeLens(root, classifyAgent(root, agentKindOverride[root.id] ?? null));
    if (lens === 'workflows') {
      return { lens, itemId: root.workflowRunId ?? null };
    }
    return { lens, itemId: root.id };
  }, [sessionAgents, agentKindOverride]);

  const nextUp = selectNextUp({
    openQuestions,
    questionBlocksRun,
    pr: pullRequest,
    waiting,
    stalledStep,
    sessionStateKind: session.state.kind,
    isFresh,
    runningAgent,
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
    <ScrollFade className="h-full" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
      <div
        className={cn(
          'animate-fade-in flex flex-col',
          PANE_RHYTHM.column,
          PANE_RHYTHM.stack,
          PANE_RHYTHM.measure.pane,
        )}
      >
        <HeaderBand session={session} stage={stage} />
        <Divider />
        <section aria-label="Next up" className="flex flex-col gap-2">
          <Eyebrow label="Next up" muted className="px-0.5 font-medium" />
          {nextUp !== null ? (
            <NextUpCard item={nextUp} onAct={() => actOnNextUp({ item: nextUp })} />
          ) : (
            <LensEmptyState
              icon={CONCEPT_ICONS.nextUp}
              tone={CONCEPT_TONE.nextUp}
              title="Nothing needs you right now"
              description="Every agent, question, and review on this session is settled. Start work from the activity below."
            />
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
          onFocusCompletedRun={(runId) => setFocusedWorkflowRun(sessionId, runId)}
          onSelectLens={onSelectLens}
        />
      </div>
    </ScrollFade>
  );
};
