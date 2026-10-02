import type { ReactNode } from 'react';
import { cn, tintClasses, Tooltip, type Tone } from '@goodboy/ui';

export const FOOTER_LABELED_PAD = 'gap-1.5 px-1.5 @min-chrome-labels/footer:px-2';
export const FOOTER_LABEL = 'hidden @min-chrome-labels/footer:inline';

type Props = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly title?: string;
  readonly onClick: () => void;
  readonly active?: boolean;
  readonly isScoped?: boolean;
  readonly tone?: Tone;
  readonly showLabel?: boolean;
};

export const FooterButton = ({
  icon,
  label,
  title,
  onClick,
  active,
  isScoped = false,
  tone = 'neutral',
  showLabel = true,
}: Props) => (
  <Tooltip content={title ?? label}>
    <button
      type="button"
      onClick={onClick}
      aria-label={title ?? label}
      aria-current={active === true || isScoped ? 'page' : undefined}
      className={cn(
        'flex items-center rounded-md py-1 text-secondary font-medium transition-colors',
        showLabel ? FOOTER_LABELED_PAD : 'px-1.5',
        active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-hover hover:text-foreground',
        isScoped && 'text-foreground ring-1 ring-inset ring-border-soft',
      )}
    >
      <span className={cn('flex items-center', active && tintClasses(tone).icon)}>{icon}</span>
      {showLabel ? <span className={FOOTER_LABEL}>{label}</span> : null}
    </button>
  </Tooltip>
);
