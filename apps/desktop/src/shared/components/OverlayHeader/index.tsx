import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import { X, type LucideIcon } from 'lucide-react';

type Props = {
  readonly icon?: LucideIcon;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly beta?: boolean;
  readonly onClose: () => void;
  readonly closeLabel: string;
  readonly closeDisabled?: boolean;
  readonly variant?: 'compact' | 'fullscreen';
  readonly children?: ReactNode;
};

export const OverlayHeader = ({
  icon: Icon,
  glyph,
  title,
  subtitle,
  beta = false,
  onClose,
  closeLabel,
  closeDisabled = false,
  variant = 'compact',
  children,
}: Props) => {
  if (variant === 'fullscreen') {
    return (
      <header className="flex shrink-0 items-center gap-3 px-6 py-3">
        {glyph ??
          (Icon != null ? <Icon size={18} className="shrink-0 text-primary" aria-hidden /> : null)}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
            {beta ? (
              <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
                beta
              </span>
            ) : null}
          </div>
          {subtitle != null ? (
            <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
          ) : null}
        </div>
        <div className="flex-1" />
        {children}
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label={closeLabel}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5',
            'text-xs font-semibold text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
            closeDisabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <X size={13} aria-hidden /> Done
        </button>
      </header>
    );
  }

  return (
    <header className="flex h-[var(--chat-header-h)] shrink-0 items-center gap-1.5 px-3">
      {glyph ??
        (Icon != null ? <Icon size={12} className="shrink-0 text-primary" aria-hidden /> : null)}
      <h1 className="shrink-0 text-2xs font-semibold text-foreground">{title}</h1>
      {beta ? (
        <span className="shrink-0 rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
          beta
        </span>
      ) : null}
      {subtitle != null && subtitle !== '' ? (
        <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
      ) : null}
      <div className="flex-1" />
      {children}
      <button
        type="button"
        onClick={onClose}
        disabled={closeDisabled}
        aria-label={closeLabel}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors',
          'hover:bg-muted/50 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
          closeDisabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <X size={14} aria-hidden />
      </button>
    </header>
  );
};
