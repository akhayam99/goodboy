import type { LucideIcon } from 'lucide-react';
import { Button, StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import { TimelineRow } from './TimelineRow';

type Props = {
  readonly icon?: LucideIcon;
  readonly tone: Tone;
  readonly label: string;
  readonly detail?: string;
  readonly isRunning?: boolean;
  readonly action?: string;
  readonly onClick?: () => void;
  readonly hasRoleColumn?: boolean;
};

export const TimelineNowRow = ({
  icon: Icon,
  tone,
  label,
  detail,
  isRunning = false,
  action,
  onClick,
  hasRoleColumn = false,
}: Props) => {
  const tint = tintClasses(tone);
  return (
    <TimelineRow
      timeLabel={null}
      depth={0}
      hasRoleColumn={hasRoleColumn}
      onClick={onClick}
      ariaLabel={action != null ? action : label}
      marker={
        isRunning ? (
          <StatusDot tone="info" size="sm" pulsing ariaLabel="In progress" />
        ) : Icon != null ? (
          <Icon size={10} aria-hidden className={tint.icon} />
        ) : (
          <span className={cn('size-2 rounded-full', tint.bg)} />
        )
      }
      label={
        <>
          <span className="min-w-0 truncate text-sm text-foreground">{label}</span>
          {detail != null ? (
            <span className="truncate text-2xs text-muted-foreground">{detail}</span>
          ) : null}
        </>
      }
      trailing={
        action != null && onClick != null ? (
          <Button variant="ghost" size="sm" onClick={onClick}>
            {action}
          </Button>
        ) : null
      }
    />
  );
};
