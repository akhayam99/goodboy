import { X } from 'lucide-react';
import { cn, FOCUS_RING, Tooltip } from '@goodboy/ui';

type Props = {
  readonly eyebrow: string;
  readonly label: string;
  readonly removeLabel: string;
  readonly onRemove: () => void;
};

export const SearchChipPill = ({ eyebrow, label, removeLabel, onRemove }: Props) => (
  <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm bg-fill pl-2 text-chip text-foreground">
    <span className="text-faint-foreground">{eyebrow}</span>
    <span className="max-w-40 truncate text-foreground">{label}</span>
    <Tooltip content={removeLabel}>
      <button
        type="button"
        aria-label={removeLabel}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRemove}
        className={cn(
          'inline-flex h-6 w-5 items-center justify-center rounded-sm text-faint-foreground hover:bg-hover hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <X size={11} aria-hidden />
      </button>
    </Tooltip>
  </span>
);
