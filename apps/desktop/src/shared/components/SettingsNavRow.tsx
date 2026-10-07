import type { ReactNode } from 'react';
import { PANE_RHYTHM, SelectableRow, StatusDot, cn, type Tone } from '@goodboy/ui';

export type SettingsNavStatus = {
  readonly tone: Tone;
  readonly label: string | null;
};

type Props = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly level: 'group' | 'page';
  readonly isCurrent?: boolean;
  readonly isActiveGroup?: boolean;
  readonly status?: SettingsNavStatus | null;
  readonly onClick: () => void;
};

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors';

export const SettingsNavRow = ({
  icon,
  label,
  level,
  isCurrent = false,
  isActiveGroup = false,
  status = null,
  onClick,
}: Props) => (
  <SelectableRow
    selected={isCurrent}
    ariaCurrent={isCurrent}
    onClick={onClick}
    className={cn(
      'h-7 items-center gap-2',
      FOCUS,
      level === 'group' ? 'px-2 text-row' : cn('pr-2 text-label', PANE_RHYTHM.navRail.nest),
      isActiveGroup && 'text-foreground',
    )}
  >
    <span aria-hidden className="flex shrink-0 items-center">
      {icon}
    </span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {status === null ? null : (
      <StatusDot
        tone={status.tone}
        size="sm"
        {...(status.label !== null && { ariaLabel: status.label })}
      />
    )}
  </SelectableRow>
);
