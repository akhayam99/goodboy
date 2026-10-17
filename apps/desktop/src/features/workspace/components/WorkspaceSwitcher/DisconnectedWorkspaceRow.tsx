import { Button } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { useNow } from '../../../../shared/hooks/useNow';
import { WorkspaceTile } from './WorkspaceTile';

type Props = {
  readonly workspace: Workspace;
  readonly onReconnect: () => void;
};

export const DisconnectedWorkspaceRow = ({ workspace, onReconnect }: Props) => {
  const now = useNow(30_000);
  const since =
    workspace.disconnectedAt === undefined || workspace.disconnectedAt === null
      ? ''
      : ` ${formatSpan({ from: workspace.disconnectedAt, to: now })}`;
  return (
    <div
      data-workspace-row={workspace.name}
      data-disconnected=""
      className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1"
    >
      <WorkspaceTile workspace={workspace} isDimmed />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-row text-muted-foreground">{workspace.name}</span>
        <span className="truncate text-meta text-faint-foreground">Disconnected{since}</span>
      </span>
      <Button
        variant="secondary"
        size="xs"
        aria-label={`Reconnect ${workspace.name}`}
        onClick={onReconnect}
      >
        Reconnect
      </Button>
    </div>
  );
};
