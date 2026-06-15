import { cn } from '@goodboy/ui';
import type { TabStatus } from '../status';

const TONE_PILL: Record<TabStatus['tone'], string> = {
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/10 text-info',
  muted: 'bg-muted text-muted-foreground',
};

type Props = {
  readonly status: TabStatus;
  readonly dim: boolean;
};

export const TabBadge = ({ status, dim }: Props) => {
  const hasCount = status.count != null && status.count > 0;
  return (
    <span
      aria-label={status.label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1 leading-none transition-opacity',
        TONE_PILL[status.tone],
        dim && 'opacity-80',
      )}
    >
      {status.icon}
      {hasCount ? (
        <span className="text-[9px] font-semibold tabular-nums">{status.count}</span>
      ) : null}
    </span>
  );
};
