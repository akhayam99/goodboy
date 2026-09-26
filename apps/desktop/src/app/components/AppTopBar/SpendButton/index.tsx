import { Tooltip, formatUsd } from '@goodboy/ui';
import { useCurrentWorkspace, useSessions, useWorkspaceRollup } from '../../../../store';

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
  const label = `Spent today in ${workspace.name}, counted by Goodboy. Open Impact`;

  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        onClick={onOpenSpend}
        aria-label={label}
        className="flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 text-secondary text-muted-foreground motion-safe:transition-colors hover:bg-hover"
      >
        <span className="font-medium tabular-nums text-foreground">
          {formatUsd(rollup.todaySpend)}
        </span>
        <span className="hidden @min-chrome-labels/topbar:inline">today</span>
      </button>
    </Tooltip>
  );
};
