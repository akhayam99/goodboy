import { Check } from 'lucide-react';
import { cn } from '../../cn';
import { tintClasses } from '../../tint';
import type { CrumbMenuRow as CrumbMenuRowModel } from './crumbMenuTypes';
import { CrumbMenuLead } from './CrumbMenuLead';

type Props = {
  readonly row: CrumbMenuRowModel;
  readonly metaWidthClass: string;
  readonly onActivate: (row: CrumbMenuRowModel) => void;
};

const middleTruncate = (text: string): string => {
  const limit = 28;
  if (text.length <= limit) {
    return text;
  }
  const keep = Math.floor((limit - 1) / 2);
  return `${text.slice(0, keep)}…${text.slice(text.length - keep)}`;
};

export const CrumbMenuRow = ({ row, metaWidthClass, onActivate }: Props) => {
  const StateGlyph = row.state?.glyph ?? null;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={row.isCurrent}
      aria-disabled={row.isDisabled ? true : undefined}
      tabIndex={-1}
      data-crumb-row={row.id}
      disabled={row.isDisabled}
      onClick={() => onActivate(row)}
      className={cn(
        'flex h-7.5 w-full min-w-0 shrink-0 items-center gap-2 rounded-md px-2 text-left outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-focus-ring',
        row.indent === 1 && 'pl-7',
        row.isCurrent ? 'bg-overlay-selected' : 'hover:bg-hover focus:bg-hover',
        row.isDisabled && 'cursor-default text-disabled-foreground hover:bg-transparent',
      )}
    >
      <CrumbMenuLead lead={row.lead} />
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span
          className={cn(
            'shrink truncate text-xs',
            row.isDisabled ? 'text-disabled-foreground' : 'text-foreground',
            row.isMiddleTruncated === true && 'font-mono text-2xs',
          )}
        >
          {row.isMiddleTruncated === true ? middleTruncate(row.label) : row.label}
        </span>
        {row.secondary != null ? (
          <span className="min-w-0 shrink-[2] truncate text-2xs text-faint-foreground">
            {row.secondary}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'shrink-0 truncate text-right text-2xs tabular-nums text-muted-foreground',
          metaWidthClass,
        )}
      >
        {row.metaA}
      </span>
      <span className="flex w-24 shrink-0 items-center justify-end gap-1.5 text-2xs">
        {row.state == null ? null : (
          <>
            {StateGlyph != null ? (
              <StateGlyph
                size={12}
                aria-hidden
                className={cn('shrink-0', tintClasses(row.state.tone).icon)}
              />
            ) : (
              <span
                aria-hidden
                className={cn('size-1.5 shrink-0 rounded-full', tintClasses(row.state.tone).dot)}
              />
            )}
            <span className="truncate text-muted-foreground">{row.state.word}</span>
          </>
        )}
      </span>
      <span className="flex w-3.5 shrink-0 items-center justify-center">
        {row.isCurrent ? <Check size={14} aria-hidden className="text-foreground" /> : null}
      </span>
    </button>
  );
};
