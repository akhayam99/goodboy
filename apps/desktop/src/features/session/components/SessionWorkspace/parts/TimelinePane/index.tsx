import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, Eyebrow, useCopyLink } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useSessionOpenQuestions,
} from '../../../../../../store';
import { notifyWorkflowGateBlock } from '../../../../../../store/slices/workflows/notifyWorkflowGateBlock';
import { useAttachedWorkflowRuns } from '../../../../../workflows/useAttachedWorkflowRuns';
import { workflowRunHasOpenQuestions } from '../../../../../context/openQuestionsGate';
import {
  resolveWorkflowAdvance,
  type WorkflowAdvanceState,
} from '../../../../../workflows/advanceGate';
import { useToast } from '../../../../../../app/components/Toast';
import { filterTimelineEntries } from '../../../../timeline/activityFilter';
import { buildTimelineGroups } from '../../../../timeline/buildTimelineGroups';
import {
  buildTimelineStream,
  type TimelineRowItem,
} from '../../../../timeline/buildTimelineStream';
import { dayLabel } from '../../../../timeline/dayLabel';
import { layoutTimelineRail } from '../../../../timeline/railGeometry';
import { useActivityFilter } from '../../../../hooks/useActivityFilter';
import { useTimelineOpen } from '../../../../hooks/useTimelineOpen';
import { ActivityFilterButton } from './ActivityFilterButton';
import { TimelineDayRule } from './TimelineDayRule';
import { TimelineNowRule } from './TimelineNowRule';
import { TimelinePendingCluster } from './TimelinePendingCluster';
import { TimelineStreamRow, type TimelineRowAction } from './TimelineStreamRow';
import type { WorkspaceRuns } from '../../../../../orchestration/hooks/useWorkspaceRuns';

type Props = {
  readonly session: Session;
  readonly runs: WorkspaceRuns;
  readonly actions: ReactNode;
};

export const TimelinePane = ({ session, runs, actions }: Props) => {
  const sessionId: SessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const plans = useAppStore((s) => s.sessionPlans?.[sessionId] ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks?.[sessionId] ?? EMPTY_ARRAY);
  const worktrees = useAppStore((s) => s.sessionWorktreeRecords?.[sessionId] ?? EMPTY_ARRAY);
  const events = useAppStore((s) => s.sessionEvents?.[sessionId] ?? EMPTY_ARRAY);
  const loadSessionEvents = useAppStore((s) => s.loadSessionEvents);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const emitNotification = useAppStore((s) => s.emitNotification);
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const isSummarizerRunning = useAppStore(
    (s) => s.summarizerStatus?.[sessionId]?.status === 'running',
  );
  const hasRunningTurn = useAppStore((s) =>
    agents.some((agent) => {
      const turn = s.agentTurnState?.[agent.id];
      return turn?.kind === 'running' || turn?.kind === 'starting';
    }),
  );
  const questions = useSessionOpenQuestions(sessionId);
  const workflows = useAttachedWorkflowRuns({ session });
  const openTargetFor = useTimelineOpen({ sessionId });
  const activity = useActivityFilter();
  const { showToast } = useToast();
  const { copied, failed, copy } = useCopyLink();

  useEffect(() => {
    void loadSessionEvents({ sessionId });
  }, [loadSessionEvents, sessionId]);

  useEffect(() => {
    if (copied) {
      showToast('success', 'path copied');
    }
  }, [copied, showToast]);

  useEffect(() => {
    if (failed) {
      showToast('error', 'copy failed');
    }
  }, [failed, showToast]);

  const model = useMemo(
    () =>
      buildTimelineGroups({
        agents,
        workflows,
        plans,
        externalTasks,
        questions,
        worktrees,
        events,
        agentKindOverride,
      }),
    [agentKindOverride, agents, events, externalTasks, plans, questions, workflows, worktrees],
  );

  const visibleEntries = useMemo(
    () => filterTimelineEntries({ entries: model.entries, filter: activity.filter }),
    [activity.filter, model.entries],
  );

  const advanceByRunId = useMemo(() => {
    const states = new Map<string, WorkflowAdvanceState>();
    for (const attached of workflows) {
      const runAgents = agents.filter(
        (agent) =>
          agent.workflowRunId === attached.run.id &&
          agent.parentAgentId == null &&
          agent.stepId != null,
      );
      states.set(
        attached.run.id,
        resolveWorkflowAdvance({
          workflow: attached.workflow,
          agents: runAgents,
          hasOpenQuestions: workflowRunHasOpenQuestions(questions, attached.run.id),
          isSummarizerRunning,
          isTurnRunning: hasRunningTurn,
          isAutoRun: attached.run.autoRun === true,
        }),
      );
    }
    return states;
  }, [agents, hasRunningTurn, isSummarizerRunning, questions, workflows]);

  const stalledRunIds = useMemo(() => {
    const stalled = new Set<string>();
    for (const lane of [
      ...runs.lanes,
      ...(runs.blockedLanes ?? []),
      ...(runs.completedLanes ?? []),
    ]) {
      if (lane.steps.some((step) => step.status === 'stalled')) {
        stalled.add(lane.runId);
      }
    }
    return stalled;
  }, [runs.lanes, runs.blockedLanes, runs.completedLanes]);

  const unreadAgentIds = useMemo(() => {
    const unread = new Set<string>();
    for (const agent of agents) {
      if (agentHasUnread(agent, false)) {
        unread.add(agent.id);
      }
    }
    return unread;
  }, [agents]);

  const blockedRunIds = useMemo(() => {
    const blocked = new Set<string>(stalledRunIds);
    for (const [runId, state] of advanceByRunId) {
      if (state.kind === 'blocked') {
        blocked.add(runId);
      }
    }
    return blocked;
  }, [advanceByRunId, stalledRunIds]);

  const stream = useMemo(
    () =>
      buildTimelineStream({
        entries: visibleEntries,
        unreadAgentIds,
        blockedRunIds,
        dayLabelFor: dayLabel,
      }),
    [blockedRunIds, unreadAgentIds, visibleEntries],
  );

  const rail = useMemo(
    () => layoutTimelineRail({ rows: stream.items, groups: stream.groups }),
    [stream.groups, stream.items],
  );

  const advanceAgent = async ({ agentId }: { readonly agentId: string }) => {
    const agent = agents.find((candidate) => candidate.id === agentId) ?? null;
    if (agent == null || agent.status !== 'pending') {
      return;
    }
    try {
      await activateWorkflowAgent({ sessionId, agentId: agent.id, focus: 'none' });
    } catch (error) {
      notifyWorkflowGateBlock({ error, sessionId, emitNotification });
    }
  };

  const actionFor = ({ item }: { readonly item: TimelineRowItem }): TimelineRowAction | null => {
    const { entry } = item;
    if (entry.kind === 'event' && entry.event.kind === 'worktree_created') {
      const worktreePath = entry.event.payload?.worktreePath ?? null;
      if (worktreePath == null) {
        return null;
      }
      return {
        label: copied ? 'Copied' : 'Copy path',
        onAct: () => void copy(worktreePath),
      };
    }
    if (entry.kind === 'agent' && entry.openQuestions.length > 0) {
      return { label: 'Answer', onAct: () => setActiveLens(sessionId, 'questions') };
    }
    if (entry.kind !== 'run') {
      return null;
    }
    if (stalledRunIds.has(entry.run.id)) {
      return {
        label: 'Restart the step',
        onAct: () => openTargetFor({ entry }).open(),
      };
    }
    const advance = advanceByRunId.get(entry.run.id) ?? { kind: 'complete' as const };
    if (advance.kind === 'blocked' && advance.reason === 'questions') {
      return { label: 'Answer', onAct: () => setActiveLens(sessionId, 'questions') };
    }
    if (advance.kind !== 'ready') {
      return null;
    }
    const pending = entry.children.find(
      (child) =>
        child.kind === 'agent' &&
        child.agent.stepId === advance.step.id &&
        child.agent.status === 'pending',
    );
    if (pending == null || pending.kind !== 'agent') {
      return null;
    }
    const { agent } = pending;
    return {
      label: `Start ${advance.step.name}`,
      onAct: () => void advanceAgent({ agentId: agent.id }),
    };
  };

  const hasUnreadAgents = unreadAgentIds.size > 0;

  return (
    <section aria-label="Activity" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 px-0.5">
        <Eyebrow label="Activity" muted className="font-medium" />
        <div className="flex items-center gap-1">
          {hasUnreadAgents ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => void markAllAgentsSeen(sessionId)}
            >
              <CheckCheck size={13} aria-hidden />
              Mark all seen
            </Button>
          ) : null}
          <ActivityFilterButton
            filter={activity.filter}
            hiddenCount={activity.hiddenCount}
            onCategory={activity.setCategory}
          />
          {actions}
        </div>
      </div>
      <div className="flex flex-col">
        {stream.items.map((item, index) => {
          const railRow = rail.rows[index];
          if (railRow === undefined) {
            return null;
          }
          if (item.kind === 'now') {
            return (
              <TimelineNowRule key={item.id} item={item} rail={railRow} railWidth={rail.width} />
            );
          }
          if (item.kind === 'day') {
            return (
              <TimelineDayRule key={item.id} item={item} rail={railRow} railWidth={rail.width} />
            );
          }
          if (item.kind === 'cluster') {
            return (
              <TimelinePendingCluster
                key={item.id}
                item={item}
                rail={railRow}
                railWidth={rail.width}
              />
            );
          }
          const target = openTargetFor({ entry: item.entry });
          return (
            <TimelineStreamRow
              key={item.id}
              item={item}
              rail={railRow}
              railWidth={rail.width}
              sessionId={sessionId}
              openLabel={target.label}
              action={actionFor({ item })}
              onOpen={target.open}
            />
          );
        })}
      </div>
    </section>
  );
};
