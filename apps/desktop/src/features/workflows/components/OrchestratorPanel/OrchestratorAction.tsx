import type { LucideIcon } from 'lucide-react';
import { Tooltip, cn, tintClasses, type Tone } from '@goodboy/ui';

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly variant: 'primary' | 'ghost';
  readonly tone?: Tone;
  readonly testId: string;
  readonly title?: string;
  readonly expanded?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
};

export const OrchestratorAction = ({
  icon: Icon,
  label,
  variant,
  tone = 'primary',
  testId,
  title,
  expanded,
  disabled = false,
  onClick,
}: Props) => {
  const tint = tintClasses(tone);

  const button = (
    <button
      type="button"
      data-testid={testId}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-2 text-2xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors disabled:pointer-events-none disabled:opacity-60',
        variant === 'primary'
          ? cn('border', tint.border, tint.bg, tint.text, tint.hoverBg)
          : 'text-muted-foreground hover:bg-foreground/10 hover:text-foreground',
      )}
    >
      <Icon size={12} aria-hidden className="shrink-0" />
      {label}
    </button>
  );

  if (title == null || title === '') {
    return button;
  }

  return (
    <Tooltip content={title} side="top">
      <span className="inline-flex shrink-0">{button}</span>
    </Tooltip>
  );
};
