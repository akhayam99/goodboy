import { Bot, CheckCheck, MessageSquareReply } from 'lucide-react';
import { Button, Eyebrow } from '@goodboy/ui';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import { PendingResolutionsStrip } from '../../../context/components/ContextPanel/strips/PendingResolutionsStrip';
import type { WorkspaceRuns } from '../../../orchestration/hooks/useWorkspaceRuns';
import { CreateAgentPopover } from '../CreateAgentPopover';
import { ActivityEmptyState } from './ActivityEmptyState';
import { PipelineSection } from './PipelineSection';
import { SummaryRow } from './SummaryRow';

type Props = {
  readonly session: Session;
  readonly workspaceId: WorkspaceId | null;
  readonly runs: WorkspaceRuns;
  readonly isFresh: boolean;
  readonly resolveCount: number;
  readonly onOpenWorkflowBuilder: () => void;
  readonly onFocusCompletedRun: (runId: string) => void;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const ActivitySection = ({
  session,
  workspaceId,
  runs,
  isFresh,
  resolveCount,
  onOpenWorkflowBuilder,
  onFocusCompletedRun,
  onSelectLens,
}: Props) => {
  const sessionId = session.id as SessionId;
  const completedLanes = runs.completedLanes ?? [];
  const completedAgents = runs.completedFreeAgents ?? [];
  const lastCompletedLane = completedLanes[completedLanes.length - 1] ?? null;

  const openCompletedWorkflows = () => {
    if (lastCompletedLane !== null) {
      onFocusCompletedRun(lastCompletedLane.runId);
    }
    onSelectLens('workflows');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <Eyebrow label="Activity" muted className="min-w-0 truncate font-medium" />
        {!isFresh && (
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onOpenWorkflowBuilder}>
              <SECTION_ICONS.workflows size={13} aria-hidden />
              New workflow
            </Button>
            <CreateAgentPopover sessionId={sessionId} variant="compact" />
          </div>
        )}
      </div>
      {isFresh ? (
        <ActivityEmptyState sessionId={sessionId} onOpenWorkflowBuilder={onOpenWorkflowBuilder} />
      ) : (
        <div className="flex flex-col gap-2">
          {workspaceId != null ? (
            <PipelineSection
              session={session}
              workspaceId={workspaceId}
              lanes={runs.lanes}
              freeAgents={runs.freeAgents}
              onSelectLens={onSelectLens}
            />
          ) : null}
          <PendingResolutionsStrip sessionId={sessionId} />
          {resolveCount > 0 ? (
            <SummaryRow
              icon={MessageSquareReply}
              tone="neutral"
              label={`${resolveCount} to resolve`}
              onClick={() => onSelectLens('resolve')}
            />
          ) : null}
          {completedLanes.length > 0 ? (
            <SummaryRow
              icon={CheckCheck}
              tone="neutral"
              label={
                completedLanes.length === 1
                  ? '1 completed workflow'
                  : `${completedLanes.length} completed workflows`
              }
              onClick={openCompletedWorkflows}
            />
          ) : null}
          {completedAgents.length > 0 ? (
            <SummaryRow
              icon={Bot}
              tone="neutral"
              label={
                completedAgents.length === 1
                  ? '1 completed agent'
                  : `${completedAgents.length} completed agents`
              }
              onClick={() => onSelectLens('agents')}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};
