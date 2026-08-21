import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, Eyebrow } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useSessionOpenQuestions,
} from '../../../../../../store';
import { useAttachedWorkflowRuns } from '../../../../../workflows/useAttachedWorkflowRuns';
import { useAdvanceWorkflowAgent } from '../../../../../workflows/useAdvanceWorkflowAgent';
import { useWorkflowAdvanceStates } from '../../../../../workflows/useWorkflowAdvanceStates';
import { buildTimelineGroups } from '../../../../timeline/buildTimelineGroups';
import {
  buildTimelineStream,
  type TimelineRowItem,
} from '../../../../timeline/buildTimelineStream';
import { dayLabel } from '../../../../timeline/dayLabel';
import { layoutTimelineRail } from '../../../../timeline/railGeometry';
import { useTimelineOpen } from '../../../../hooks/useTimelineOpen';
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
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const questions = useSessionOpenQuestions(sessionId);
  const workflows = useAttachedWorkflowRuns({ session });
  const openTargetFor = useTimelineOpen({ sessionId });
  const advanceAgent = useAdvanceWorkflowAgent({ sessionId });

  const model = useMemo(
    () =>
      buildTimelineGroups({
        agents,
        workflows,
        plans,
        externalTasks,
        questions,
        worktrees,
        agentKindOverride,
      }),
    [agentKindOverride, agents, externalTasks, plans, questions, workflows, worktrees],
  );

  const advanceByRunId = useWorkflowAdvanceStates({ sessionId, workflows, agents });

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
        entries: model.entries,
        unreadAgentIds,
        blockedRunIds,
        dayLabelFor: dayLabel,
      }),
    [blockedRunIds, model.entries, unreadAgentIds],
  );

  const rail = useMemo(
    () => layoutTimelineRail({ rows: stream.items, groups: stream.groups }),
    [stream.groups, stream.items],
  );

  const actionFor = ({ item }: { readonly item: TimelineRowItem }): TimelineRowAction | null => {
    const { entry } = item;
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
      onAct: () => void advanceAgent({ agent }),
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
