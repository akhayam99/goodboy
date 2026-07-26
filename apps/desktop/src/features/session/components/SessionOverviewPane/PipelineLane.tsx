import { ArrowRight } from 'lucide-react';
import { Chip } from '@goodboy/ui';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import type { RunLaneModel } from '../../../orchestration/hooks/useWorkspaceRuns';
import { pickNextWorkflowStep } from '../../../workflows/components/WorkflowNextStepCta';
import type { LaneAdvance } from './LaneAdvance';
import { StepBadge } from './StepBadge';

type Props = {
  readonly lane: RunLaneModel;
  readonly onOpen: () => void;
  readonly advance?: LaneAdvance;
};

export const PipelineLane = ({ lane, onOpen, advance }: Props) => {
  const done = lane.steps.filter((s) => s.status === 'done').length;
  const nextStep = advance
    ? pickNextWorkflowStep(advance.workflow, advance.runs, {
        hasOpenQuestions: advance.hasOpenQuestions,
      })
    : null;
  return (
    <div className="group flex flex-col gap-2 rounded-lg border border-border-soft bg-elevated px-3.5 py-3 shadow-sm transition-colors hover:border-border">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-2 text-left">
        <SECTION_ICONS.workflows size={13} aria-hidden className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {lane.workflowName}
        </span>
        {lane.autoRun ? <Chip tone="danger" size="sm" label="auto" /> : null}
        <span className="shrink-0 tabular-nums text-2xs text-muted-foreground/60">
          {done}/{lane.steps.length}
        </span>
        <ArrowRight
          size={14}
          aria-hidden
          className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
        />
      </button>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {lane.steps.map((step) => (
          <StepBadge
            key={step.stepId}
            step={step}
            onAdvance={
              nextStep && advance && step.stepId === nextStep.id
                ? () => void advance.onAdvance(nextStep)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
};
