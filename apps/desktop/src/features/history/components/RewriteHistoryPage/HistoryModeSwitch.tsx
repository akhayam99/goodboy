import { FOCUS_RING, cn } from '@goodboy/ui';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import type { CombineMode } from '../../historyPlan';

type Props = {
  readonly mode: CombineMode;
  readonly onChange: (mode: CombineMode) => void;
  readonly isDisabled?: boolean;
};

const OPTIONS: ReadonlyArray<{
  readonly mode: CombineMode;
  readonly label: string;
  readonly hint: string;
}> = [
  {
    mode: 'fixup',
    label: 'Keep title',
    hint: 'Fold in (fixup): keeps only the title of the commit it goes into.',
  },
  { mode: 'squash', label: 'Keep both', hint: 'Combine (squash): keeps both commit messages.' },
];

export const HistoryModeSwitch = ({ mode, onChange, isDisabled = false }: Props) => (
  <span
    role="group"
    aria-label="What to keep"
    className="inline-flex shrink-0 gap-px rounded-md border border-border-soft bg-fill p-0.5"
  >
    {OPTIONS.map((option) => {
      const isPressed = option.mode === mode;
      return (
        <button
          key={option.mode}
          type="button"
          title={option.hint}
          aria-pressed={isPressed}
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onChange(option.mode);
          }}
          className={cn(
            'rounded-sm border px-2 text-secondary whitespace-nowrap',
            FOCUS_RING,
            isPressed
              ? HISTORY_ACTION_CLASSES[option.mode].mark
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      );
    })}
  </span>
);
