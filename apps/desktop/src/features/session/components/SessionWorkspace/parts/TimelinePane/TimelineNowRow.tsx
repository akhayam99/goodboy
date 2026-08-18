import type { LucideIcon } from 'lucide-react';
import { Button, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';

type Props = {
  readonly icon?: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
  readonly detail?: string;
  readonly isRunning?: boolean;
  readonly action?: string;
  readonly onClick?: () => void;
};

export const TimelineNowRow = ({
  icon: Icon,
  tone,
  label,
  detail,
  isRunning = false,
  action,
  onClick,
}: Props) => {
  const tint = tintClasses(tone);
  return (
    <div className="grid min-h-9 grid-cols-[44px_24px_minmax(0,1fr)]">
      <span />
      <div className="relative flex items-center justify-center">
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
        <span className="relative z-10 flex size-4 items-center justify-center bg-canvas">
          {isRunning ? (
            <StatusDot tone="info" size="sm" pulsing ariaLabel="In progress" />
          ) : Icon != null ? (
            <Icon size={10} aria-hidden className={tint.icon} />
          ) : (
            <span className={cn('size-2 rounded-full', tint.bg)} />
          )}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 py-1.5">
        <button
          type="button"
          disabled={onClick == null}
          onClick={onClick}
          className="flex min-w-0 items-center gap-2 text-left disabled:cursor-default"
        >
          <span className="truncate text-sm text-foreground">{label}</span>
          {detail != null ? (
            <span className="truncate text-2xs text-muted-foreground">{detail}</span>
          ) : null}
        </button>
        {action != null ? (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClick}>
            {action}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
