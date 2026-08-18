import type { ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';
import { X, type LucideIcon } from 'lucide-react';
import { Tooltip } from './Tooltip';

type Props = {
  readonly icon?: LucideIcon;
  readonly tone?: Tone;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly onClose: () => void;
  readonly closeLabel: string;
  readonly closeDisabled?: boolean;
  readonly variant?: 'compact' | 'fullscreen';
  readonly heightClassName?: string;
  readonly children?: ReactNode;
};

export const OverlayHeader = ({
  icon: Icon,
  tone = 'primary',
  glyph,
  title,
  subtitle,
  onClose,
  closeLabel,
  closeDisabled = false,
  variant = 'compact',
  heightClassName,
  children,
}: Props) => {
  if (variant === 'fullscreen') {
    return (
      <header className="flex shrink-0 items-center gap-3 px-6 py-3">
        {glyph ??
          (Icon != null ? (
            <Icon size={18} className={cn('shrink-0', tintClasses(tone).icon)} aria-hidden />
          ) : null)}
        <div className="flex min-w-0 flex-col">
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
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
    <header className={cn('flex shrink-0 items-center gap-1.5 px-3', heightClassName)}>
      {glyph ??
        (Icon != null ? (
          <Icon size={12} className={cn('shrink-0', tintClasses(tone).icon)} aria-hidden />
        ) : null)}
      <h1 className="shrink-0 text-2xs font-semibold text-foreground">{title}</h1>
      {subtitle != null && subtitle !== '' ? (
        <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
      ) : null}
      <div className="flex-1" />
      {children}
      <Tooltip content={closeLabel} anchorClassName="shrink-0">
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
      </Tooltip>
    </header>
  );
};
