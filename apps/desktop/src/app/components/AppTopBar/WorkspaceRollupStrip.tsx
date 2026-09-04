import { StatusDot, formatUsd } from '@goodboy/ui';
import {
  useCurrentWorkspace,
  useSessions,
  useStageGroupedSessions,
  useWorkspaceRollup,
} from '../../../store';
import { NeedsYouPopover } from './NeedsYouPopover';

type Props = {
  readonly onOpenSpend: () => void;
};

export const WorkspaceRollupStrip = ({ onOpenSpend }: Props) => {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const workspaceId = workspace?.id ?? null;
  const rollup = useWorkspaceRollup(workspaceId, sessions);
  const groups = useStageGroupedSessions(workspaceId, sessions);
  const attentionSessions = groups.find((group) => group.key === 'attention')?.sessions ?? [];

  if (workspace == null) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-1 text-2xs">
      {rollup.attentionCount > 0 ? (
        <NeedsYouPopover sessions={attentionSessions} count={rollup.attentionCount} />
      ) : null}
      <button
        type="button"
        onClick={onOpenSpend}
        title="Today's spend across providers, open the impact studio"
        className="flex items-center gap-3 rounded px-1.5 py-1 transition-colors hover:bg-muted/50"
      >
        {rollup.runningCount > 0 ? (
          <span className="flex items-center gap-1">
            <StatusDot tone="info" size="sm" pulsing />
            <span className="font-medium tabular-nums text-foreground">{rollup.runningCount}</span>
            <span className="text-muted-foreground">running</span>
          </span>
        ) : null}
        <span className="flex items-center gap-1 text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">
            {formatUsd(rollup.todaySpend)}
          </span>
          today
        </span>
      </button>
    </div>
  );
};
