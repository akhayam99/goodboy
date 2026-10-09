import { FOCUS_RING, TOP_BAR_CONTROL, Tooltip, cn, formatUsd } from '@goodboy/ui';
import { useCurrentWorkspace, useSessions, useWorkspaceRollup } from '../../../store';

type Props = {
  readonly onOpenSpend: () => void;
};

export const SpendButton = ({ onOpenSpend }: Props) => {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const rollup = useWorkspaceRollup(workspace?.id ?? null, sessions);

  if (workspace == null) {
    return null;
  }
  const label = 'Spend today. Open Impact';

  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        onClick={onOpenSpend}
        aria-label={label}
        className={cn(
          TOP_BAR_CONTROL.height,
          TOP_BAR_CONTROL.radius,
          FOCUS_RING,
          'flex shrink-0 items-center gap-1 px-2 text-chip text-muted-foreground motion-safe:transition-colors hover:bg-hover',
        )}
      >
        <span className="font-medium tabular-nums text-foreground">
          {formatUsd(rollup.todaySpend)}
        </span>
        <span className="hidden @min-chrome-labels/topbar:inline">today</span>
      </button>
    </Tooltip>
  );
};
