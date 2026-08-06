import type { ReactNode } from 'react';
import { cn, tintClasses, Tooltip, type Tone } from '@goodboy/ui';

type Props = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly title?: string;
  readonly onClick: () => void;
  readonly pulse?: boolean;
  readonly active?: boolean;
  readonly tone?: Tone;
  readonly showLabel?: boolean;
};

export const FooterButton = ({
  icon,
  label,
  title,
  onClick,
  pulse,
  active,
  tone = 'neutral',
  showLabel = true,
}: Props) => (
  <Tooltip content={title ?? label}>
    <button
      type="button"
      onClick={onClick}
      aria-label={title ?? label}
      className={cn(
        'flex items-center rounded-md py-1 text-2xs font-medium transition-colors',
        showLabel ? 'gap-1.5 px-2' : 'px-1.5',
        active
          ? 'bg-muted text-foreground'
          : pulse
            ? 'text-info motion-safe:animate-soft-pulse hover:bg-info/10'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <span className={cn('flex items-center', active && tintClasses(tone).icon)}>{icon}</span>
      {showLabel ? <span>{label}</span> : null}
    </button>
  </Tooltip>
);
