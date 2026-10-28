import { FactCard, ROW_INTERACTIVE, cn, type FactCardSpec } from '@goodboy/ui';
import type { LiveRunStepModel } from './liveGroupsOf';
import { stepCountOf } from './stepCountOf';
import { stepFillOf } from './stepFillOf';

type Props = {
  readonly steps: ReadonlyArray<LiveRunStepModel>;
  readonly startedCount: number;
  readonly label: string;
  readonly card: FactCardSpec;
  readonly onOpen: () => void;
};

const MAX_COUNTED_STEPS = 2;

export const StepMeter = ({ steps, startedCount, label, card, onOpen }: Props) => {
  const isCount = steps.length <= MAX_COUNTED_STEPS;
  return (
    <FactCard card={card} side="bottom">
      <button
        type="button"
        aria-label={label}
        data-step-meter=""
        onClick={onOpen}
        className={cn(
          'pointer-events-auto relative flex shrink-0 items-center gap-0.5 self-stretch rounded-sm',
          isCount ? 'w-8 justify-end' : 'w-24',
          ROW_INTERACTIVE,
        )}
      >
        {isCount ? (
          <span data-step-count="" className="text-meta tabular-nums text-faint-foreground">
            {stepCountOf({ started: startedCount, total: steps.length })}
          </span>
        ) : (
          steps.map((step) => (
            <span
              key={step.number}
              data-step-state={step.state}
              className={cn('h-1.5 min-w-0 flex-1 rounded-full', stepFillOf({ state: step.state }))}
            />
          ))
        )}
      </button>
    </FactCard>
  );
};
