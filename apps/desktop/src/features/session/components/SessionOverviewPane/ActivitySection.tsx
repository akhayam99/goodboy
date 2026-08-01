import { CheckCheck, MessageSquareReply } from 'lucide-react';
import { Button, Eyebrow } from '@goodboy/ui';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
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
  readonly onSelectLens: (lens: LensKind) => void;
};

export const ActivitySection = ({
  session,
  workspaceId,
  runs,
  isFresh,
  resolveCount,
  onOpenWorkflowBuilder,
  onSelectLens,
}: Props) => {
  const sessionId = session.id as SessionId;
  const completedLanes = runs.completedLanes ?? [];
  const completedAgents = runs.completedFreeAgents ?? [];
  const completedCount = completedLanes.length + completedAgents.length;
  const completedLens: LensKind = completedLanes.length > 0 ? 'workflows' : 'agents';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <Eyebrow label="Activity" muted className="font-medium" />
        {!isFresh && (
          <div className="flex items-center gap-1">
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
          {resolveCount > 0 ? (
            <SummaryRow
              icon={MessageSquareReply}
              tone="neutral"
              label={`${resolveCount} to resolve`}
              onClick={() => onSelectLens('resolve')}
            />
          ) : null}
          {completedCount > 0 ? (
            <SummaryRow
              icon={CheckCheck}
              tone="neutral"
              label={`${completedCount} completed`}
              onClick={() => onSelectLens(completedLens)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};
