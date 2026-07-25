import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly glyph?: ReactNode;
  readonly tag?: string;
  readonly note?: string;
  readonly labelClassName?: string;
  readonly indented?: boolean;
  readonly title?: string;
};

export const OptionRow = ({
  label,
  active,
  onSelect,
  glyph,
  tag,
  note,
  labelClassName,
  indented = false,
  title,
}: Props) => (
  <button
    type="button"
    onClick={onSelect}
    title={title}
    aria-pressed={active}
    className={cn(
      'flex w-full items-center gap-2 py-1.5 pr-2.5 text-left text-xs transition-colors',
      indented ? 'pl-6' : 'pl-2.5',
      active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/50',
    )}
  >
    {glyph}
    <span className={cn('min-w-0 flex-1 truncate', active && 'font-medium', labelClassName)}>
      {label}
    </span>
    {note != null && <span className="shrink-0 text-2xs text-muted-foreground/60">{note}</span>}
    {tag != null && (
      <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/70">
        {tag}
      </span>
    )}
    {active && <Check size={11} className="shrink-0 text-primary" aria-hidden />}
  </button>
);
