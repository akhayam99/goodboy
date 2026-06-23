import type { AgentId } from '@goodboy/types';
import { Chip, cn } from '@goodboy/ui';
import { Link2 } from 'lucide-react';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../session/session-stage';
import { StepPipeline } from '../StepPipeline';
import type { RunLaneModel } from '../../hooks/useWorkspaceRuns';

type RunLaneProps = {
  readonly lane: RunLaneModel;
  readonly onSelectAgent: (agentId: AgentId) => void;
  readonly onJumpToComment: (url: string) => void;
};

export const RunLane = ({ lane, onSelectAgent, onJumpToComment }: RunLaneProps) => {
  const running = lane.stage === 'running';
  const stageMeta = SESSION_STAGE_META[lane.stage];

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border-soft bg-muted/20 p-3 sm:flex-row sm:items-start sm:gap-4',
        running && 'spin-border spin-border-info',
      )}
    >
      <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-48">
        <span className="truncate text-sm font-medium text-foreground">{lane.workflowName}</span>
        <span className="truncate text-2xs text-muted-foreground">{lane.sessionGoal}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={STAGE_TONE[lane.stage]} size="sm" label={stageMeta.label} />
          {lane.autoRun ? <Chip tone="danger" size="sm" label="auto" /> : null}
          {lane.costUsd > 0 ? (
            <span
              className="tabular-nums text-2xs text-muted-foreground/70"
              title={`$${lane.costUsd.toFixed(4)}`}
            >
              ${lane.costUsd.toFixed(2)}
            </span>
          ) : null}
        </div>
        {lane.chainAfterId != null ? (
          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground/60">
            <Link2 size={10} aria-hidden /> chained
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <StepPipeline
          steps={lane.steps}
          onSelect={onSelectAgent}
          onJumpToComment={onJumpToComment}
        />
      </div>
    </div>
  );
};
