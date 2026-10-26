import { Check } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';

export type StepState = 'done' | 'current' | 'todo';

type Props = {
  readonly label: string;
  readonly state: StepState;
  readonly onSelect: () => void;
};

export const DemoRailStep = ({ label, state, onSelect }: Props) => (
  <button
    type="button"
    onClick={onSelect}
    aria-current={state === 'current' ? 'step' : undefined}
    data-state={state}
    className={cn(
      'grid w-full grid-cols-[14px_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-1 text-left',
      ROW_INTERACTIVE,
      'data-[state=current]:bg-selected data-[state=current]:hover:bg-selected',
    )}
  >
    <span className="flex items-center justify-center">
      {state === 'done' ? (
        <Check size={ICON_SIZE.row} className="text-faint-foreground" aria-hidden />
      ) : null}
      {state === 'current' ? <span className="size-2 rounded-full bg-primary" aria-hidden /> : null}
    </span>
    <span
      className={cn(
        'truncate text-label',
        state === 'current' ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {label}
    </span>
  </button>
);
