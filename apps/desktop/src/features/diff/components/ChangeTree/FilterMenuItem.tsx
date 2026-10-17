import { Check } from 'lucide-react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly label: string;
  readonly count?: number;
  readonly isChecked: boolean;
  readonly onChoose: () => void;
};

export const FilterMenuItem = ({ label, count, isChecked, onChoose }: Props) => (
  <button
    type="button"
    role="menuitemradio"
    aria-checked={isChecked}
    onClick={onChoose}
    className={cn('flex w-full items-center gap-3 px-3 py-1 text-left text-label', ROW_INTERACTIVE)}
  >
    <span className="flex-1">{label}</span>
    {count === undefined ? null : (
      <span className="tabular-nums text-faint-foreground">{count}</span>
    )}
    <span className="size-3 shrink-0">
      {isChecked ? <Check size={ICON_SIZE.row} aria-hidden /> : null}
    </span>
  </button>
);
