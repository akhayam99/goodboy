import { Check, RotateCcw } from 'lucide-react';
import type { WorkflowAutonomy } from '@goodboy/types';
import { AnchoredPopover, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { RUN_AUTONOMY_HEADER, RUN_AUTONOMY_OPTIONS, runAutonomyOf } from '../../../runAutonomy';
import { ControlChip } from './ControlChip';
import { RuleDot } from './RuleDot';

type Props = {
  readonly autonomy: WorkflowAutonomy;
  readonly ruleAutonomy: WorkflowAutonomy;
  readonly disabled: boolean;
  readonly onChange: (autonomy: WorkflowAutonomy) => void;
};

const OPTION_ROW =
  'flex min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-hover';

export const AutonomyChip = ({ autonomy, ruleAutonomy, disabled, onChange }: Props) => {
  const dropdown = useDropdown({ disabled, width: 'w-80' });
  const { open, close, toggle } = dropdown;
  const current = runAutonomyOf({ autoRun: autonomy !== 'step', autonomy });
  const rule = runAutonomyOf({ autoRun: ruleAutonomy !== 'step', autonomy: ruleAutonomy });
  const differs = autonomy !== ruleAutonomy;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={RUN_AUTONOMY_HEADER}
      className="flex flex-col p-1"
      trigger={
        <ControlChip
          label={RUN_AUTONOMY_HEADER}
          isLabelShown={false}
          value={current.label}
          marker={differs ? <RuleDot ruleValue={rule.label} /> : null}
          isOpen={open}
          disabled={disabled}
          onToggle={toggle}
        />
      }
    >
      <div role="radiogroup" aria-label={RUN_AUTONOMY_HEADER} className="flex flex-col">
        {RUN_AUTONOMY_OPTIONS.map((option) => {
          const isActive = option.key === current.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => {
                onChange(option.key);
                close();
              }}
              className={cn(OPTION_ROW, isActive && 'bg-hover')}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-label text-foreground">{option.label}</span>
                <span className="text-meta text-faint-foreground">{option.hint}</span>
              </span>
              {isActive ? (
                <Check size={ICON_SIZE.row} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
      {differs ? (
        <button
          type="button"
          onClick={() => {
            onChange(ruleAutonomy);
            close();
          }}
          className={cn(OPTION_ROW, 'mt-1 items-center')}
        >
          <RotateCcw size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-label text-foreground">Reset</span>
          <span className="truncate text-meta text-faint-foreground">{rule.label}</span>
        </button>
      ) : null}
    </AnchoredPopover>
  );
};
