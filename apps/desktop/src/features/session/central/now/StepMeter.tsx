import { FactCard, ROW_INTERACTIVE, cn, type FactCardSpec } from '@goodboy/ui';
import { AGENT_KIND_PALETTE } from '../../agent-kind';
import type { LiveRunStepModel } from './liveGroupsOf';

type Props = {
  readonly steps: ReadonlyArray<LiveRunStepModel>;
  readonly label: string;
  readonly card: FactCardSpec;
  readonly onOpen: () => void;
};

type StepParams = {
  readonly step: LiveRunStepModel;
};

const fillOf = ({ step }: StepParams): string => {
  switch (step.state) {
    case 'running':
      return AGENT_KIND_PALETTE[step.kind].bg;
    case 'done':
      return 'bg-muted-foreground';
    case 'waiting':
      return 'bg-warning';
    case 'failed':
      return 'bg-danger';
    case 'notStarted':
      return 'bg-border';
    default: {
      const exhaustive: never = step.state;
      return exhaustive;
    }
  }
};

export const StepMeter = ({ steps, label, card, onOpen }: Props) => (
  <FactCard card={card} side="bottom">
    <button
      type="button"
      aria-label={label}
      data-step-meter=""
      onClick={onOpen}
      className={cn(
        'flex w-24 shrink-0 items-center gap-0.5 self-stretch rounded-sm',
        ROW_INTERACTIVE,
      )}
    >
      {steps.map((step) => (
        <span
          key={step.number}
          data-step-state={step.state}
          data-step-kind={step.kind}
          className={cn('h-1.5 min-w-0 flex-1 rounded-full', fillOf({ step }))}
        />
      ))}
    </button>
  </FactCard>
);
