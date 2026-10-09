import { Circle, CircleDot } from 'lucide-react';
import type { WorkflowAutonomy } from '@goodboy/types';
import { ROW_INTERACTIVE, Band, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RUN_AUTONOMY_HEADER, RUN_AUTONOMY_OPTIONS } from '../../runAutonomy';

type Props = {
  readonly autonomy: WorkflowAutonomy;
  readonly onChange: (autonomy: WorkflowAutonomy) => void;
};

export const RulesAutonomyBand = ({ autonomy, onChange }: Props) => (
  <Band label={RUN_AUTONOMY_HEADER} ariaLabel={RUN_AUTONOMY_HEADER} headingLevel={3}>
    <div role="radiogroup" aria-label={RUN_AUTONOMY_HEADER} className="flex flex-col">
      {RUN_AUTONOMY_OPTIONS.map((option) => {
        const isChecked = option.key === autonomy;
        const RadioIcon = isChecked ? CircleDot : Circle;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={isChecked}
            onClick={() => onChange(option.key)}
            className={cn(
              'flex min-h-9 w-full items-center gap-2 rounded-sm px-2 py-1 text-left',
              ROW_INTERACTIVE,
              isChecked && 'bg-hover',
            )}
          >
            <RadioIcon
              size={ICON_SIZE.row}
              aria-hidden
              className={cn('shrink-0', isChecked ? 'text-primary' : 'text-faint-foreground')}
            />
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
              <span className="text-row text-foreground">{option.label}</span>
              <span className="text-meta text-muted-foreground">{option.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  </Band>
);
