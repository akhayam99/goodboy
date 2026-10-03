import { Check } from 'lucide-react';
import { AnchoredPopover, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { RUN_AUTONOMY_HEADER, RUN_AUTONOMY_OPTIONS, runAutonomyOf } from '../../../runAutonomy';
import { ControlChip } from './ControlChip';

type Props = {
  readonly autoRun: boolean;
  readonly disabled: boolean;
  readonly onChange: (autoRun: boolean) => void;
};

export const AutonomyChip = ({ autoRun, disabled, onChange }: Props) => {
  const dropdown = useDropdown({ disabled, width: 'w-72' });
  const { open, close, toggle } = dropdown;
  const current = runAutonomyOf({ autoRun });

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
                onChange(option.autoRun);
                close();
              }}
              className={cn(
                'flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover',
                isActive && 'bg-hover',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-label text-foreground">{option.label}</span>
                <span className="text-secondary text-faint-foreground">{option.hint}</span>
              </span>
              {isActive ? (
                <Check size={ICON_SIZE.row} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
    </AnchoredPopover>
  );
};
