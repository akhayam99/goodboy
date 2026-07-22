import { ArrowRight } from 'lucide-react';
import type { SpawnNodeStatus } from '../../../orchestration/components/SpawnTree/lib';
import type { RunLaneModel } from '../../../orchestration/hooks/useWorkspaceRuns';
import { StatusGlyph } from './StatusGlyph';
import { StepBadge } from './StepBadge';

type Props = {
  readonly lane: RunLaneModel;
  readonly onOpen: () => void;
};

export const CompletedPipelineLane = ({ lane, onOpen }: Props) => {
  const done = lane.steps.filter((step) => step.status === 'done').length;
  const status: SpawnNodeStatus = done === lane.steps.length ? 'done' : 'stalled';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3.5 py-2 text-left transition-colors hover:border-border"
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <StatusGlyph status={status} />
      </span>
      <span className="min-w-0 shrink truncate text-sm font-medium text-foreground">
        {lane.workflowName}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {lane.steps.map((step) => (
          <StepBadge key={step.stepId} step={step} />
        ))}
      </span>
      <span className="shrink-0 tabular-nums text-2xs text-muted-foreground/60">
        {done}/{lane.steps.length}
      </span>
      <ArrowRight
        size={14}
        aria-hidden
        className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    </button>
  );
};
