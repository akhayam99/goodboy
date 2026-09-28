import { FOCUS_RING, cn } from '@goodboy/ui';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import type { CombineMode } from '../../historyPlan';

type Props = {
  readonly mode: CombineMode;
  readonly onChange: (mode: CombineMode) => void;
  readonly onSeparate?: () => void;
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

const OPTION_CLASS = 'rounded-sm border px-2 text-secondary whitespace-nowrap';
const IDLE_CLASS = 'border-transparent text-muted-foreground hover:text-foreground';

export const HistoryModeSwitch = ({ mode, onChange, onSeparate, isDisabled = false }: Props) => (
  <span
    role="group"
    aria-label={onSeparate === undefined ? 'What to keep' : 'Where this commit goes'}
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
            OPTION_CLASS,
            FOCUS_RING,
            isPressed ? HISTORY_ACTION_CLASSES[option.mode].mark : IDLE_CLASS,
          )}
        >
          {option.label}
        </button>
      );
    })}
    {onSeparate === undefined ? null : (
      <button
        type="button"
        title="Make it its own commit again"
        aria-pressed={false}
        disabled={isDisabled}
        onClick={(event) => {
          event.stopPropagation();
          onSeparate();
        }}
        className={cn(OPTION_CLASS, FOCUS_RING, IDLE_CLASS)}
      >
        Separate
      </button>
    )}
  </span>
);
