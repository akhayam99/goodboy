import { Circle, CircleDot } from 'lucide-react';
import type { WorkflowAutonomy } from '@goodboy/types';
import { Band, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RUN_AUTONOMY_OPTIONS } from '../../runAutonomy';

type Props = {
  readonly autonomy: WorkflowAutonomy;
  readonly onChange: (autonomy: WorkflowAutonomy) => void;
};

const RULE_HINT: Readonly<Record<WorkflowAutonomy, string>> = {
  step: 'Pauses after every step so you can review it.',
  plan: 'Pauses once when the plan is written. Approve it and the rest runs on its own.',
  run: 'Each next step starts when the last one finishes.',
};

export const RulesAutonomyBand = ({ autonomy, onChange }: Props) => (
  <Band label="Autonomy" ariaLabel="Autonomy" headingLevel={2}>
    <div role="radiogroup" aria-label="Autonomy for new runs" className="flex flex-col">
      {RUN_AUTONOMY_OPTIONS.map((option) => {
        const isChecked = option.key === autonomy;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={isChecked}
            onClick={() => onChange(option.key)}
            className={cn(
              'flex min-h-9 w-full items-start gap-3 rounded-sm px-2 py-2 text-left motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isChecked && 'bg-hover',
            )}
          >
            {isChecked ? (
              <CircleDot
                size={ICON_SIZE.row}
                aria-hidden
                className="mt-0.5 shrink-0 text-primary"
              />
            ) : (
              <Circle
                size={ICON_SIZE.row}
                aria-hidden
                className="mt-0.5 shrink-0 text-faint-foreground"
              />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-label text-foreground">{option.label}</span>
              <span className="text-secondary text-muted-foreground">{RULE_HINT[option.key]}</span>
            </span>
          </button>
        );
      })}
    </div>
  </Band>
);
