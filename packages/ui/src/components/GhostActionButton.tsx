import type { LucideIcon } from 'lucide-react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';
import { StatusDot } from './StatusDot';

export type GhostActionButtonProps = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone?: Tone;
  readonly pressed?: boolean;
  readonly highlighted?: boolean;
  readonly disabled?: boolean;
  readonly isBusy?: boolean;
  readonly busyLabel?: string;
  readonly title?: string;
  readonly ariaLabel?: string;
  readonly onClick: () => void;
};

export const GhostActionButton = ({
  icon: Icon,
  label,
  tone = 'neutral',
  pressed,
  highlighted = false,
  disabled = false,
  isBusy = false,
  busyLabel,
  title,
  ariaLabel,
  onClick,
}: GhostActionButtonProps) => {
  const tint = tintClasses(tone);

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      aria-busy={isBusy ? true : undefined}
      disabled={disabled || isBusy}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-2xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:pointer-events-none disabled:opacity-40',
        tone === 'neutral'
          ? 'text-muted-foreground hover:bg-foreground/10 hover:text-foreground'
          : cn(tint.text, tint.hoverBg),
        highlighted && cn(tint.bg, tint.text),
      )}
    >
      {isBusy ? (
        <StatusDot tone="neutral" size="sm" pulsing className="bg-current" />
      ) : (
        <Icon size={14} aria-hidden />
      )}
      {isBusy ? (busyLabel ?? label) : label}
    </button>
  );
};
