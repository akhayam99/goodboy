import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly glyph?: ReactNode;
  readonly note?: string;
  readonly title?: string;
};

export const PickerChip = ({ label, active, onSelect, glyph, note, title }: Props) => (
  <button
    type="button"
    onClick={onSelect}
    title={title}
    aria-pressed={active}
    className={cn(
      'inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
      active
        ? 'bg-background font-medium text-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
    )}
  >
    {glyph}
    <span className="truncate">{label}</span>
    {note != null && <span className="text-2xs text-muted-foreground/60">{note}</span>}
  </button>
);
