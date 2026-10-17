import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

const ROLE_OF_KIND = { single: 'radio', multiple: 'checkbox' } as const;

type Props = {
  readonly kind: 'single' | 'multiple';
  readonly label: string;
  readonly isChecked: boolean;
  readonly onSelect: () => void;
  readonly count?: number;
};

export const FilterChoice = ({ kind, label, isChecked, onSelect, count }: Props) => {
  const isEmpty = count === 0 && !isChecked;
  return (
    <button
      type="button"
      role={ROLE_OF_KIND[kind]}
      aria-checked={isChecked}
      data-filter-empty={isEmpty || undefined}
      onClick={onSelect}
      className={cn(
        'flex min-h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-label motion-safe:transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none',
        isChecked ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        isEmpty && 'text-faint-foreground',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count === undefined || count === 0 ? null : (
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{count}</span>
      )}
      <span
        data-filter-check=""
        className="flex w-3.5 shrink-0 items-center justify-center text-muted-foreground"
      >
        {isChecked ? <Check size={ICON_SIZE.row} aria-hidden /> : null}
      </span>
    </button>
  );
};
