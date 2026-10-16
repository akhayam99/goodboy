import { Check } from 'lucide-react';
import { AnchoredPopover, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ControlChip } from '../../../../shared/components/ControlChip';
import { RUNS_AS_OPTIONS, type RunsAs } from './runsAs';

type Props = {
  readonly value: RunsAs;
  readonly isDisabled: boolean;
  readonly onChange: (value: RunsAs) => void;
};

const RUNS_AS_LABEL = 'Runs as';

export const RunsAsChip = ({ value, isDisabled, onChange }: Props) => {
  const dropdown = useDropdown({ disabled: isDisabled, width: 'w-60', expectedHeight: 140 });
  const current = RUNS_AS_OPTIONS.find((option) => option.value === value) ?? RUNS_AS_OPTIONS[0];
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={RUNS_AS_LABEL}
      className="flex flex-col p-1"
      trigger={
        <ControlChip
          label={RUNS_AS_LABEL}
          value={current.label}
          isOpen={dropdown.open}
          isDisabled={isDisabled}
          onToggle={dropdown.toggle}
        />
      }
    >
      <div role="menu" aria-label={RUNS_AS_LABEL} className="flex flex-col">
        {RUNS_AS_OPTIONS.map((option) => {
          const isActive = option.value === value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={isActive}
              onClick={() => {
                onChange(option.value);
                dropdown.close();
              }}
              className={cn(
                'flex min-h-8 min-w-0 items-center gap-2 rounded-md px-2 text-left text-label text-foreground transition-colors hover:bg-hover',
                isActive && 'bg-hover',
              )}
            >
              <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {isActive ? (
                <Check size={ICON_SIZE.row} aria-hidden className="shrink-0 text-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
    </AnchoredPopover>
  );
};
