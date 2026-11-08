import { Button, Chip, StateDot } from '@goodboy/ui';
import type { SessionProjectMount, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useRunningHere } from '../../hooks/useRunningHere';

const SHOWN = 3;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly mount: Pick<SessionProjectMount, 'projectId' | 'branch'> | null;
  readonly isActive?: boolean;
};

export const BranchRunningLine = ({ workspaceId, mount, isActive = true }: Props) => {
  const openStudio = useAppStore((state) => state.openStudio);
  const { target, items } = useRunningHere({
    workspaceId,
    projectId: mount?.projectId ?? null,
    branch: mount?.branch ?? null,
    isActive,
  });
  if (target === null || items.length === 0) {
    return null;
  }
  const openMonitoring = (): void => openStudio({ studio: { kind: 'monitoring', target } });
  const hidden = items.length - SHOWN;
  return (
    <div data-branch-running-line="" className="flex min-w-0 flex-wrap items-center gap-2 text-ui">
      <span className="text-muted-foreground">Running here</span>
      {items.slice(0, SHOWN).map((item) => (
        <Chip
          key={item.key}
          as="button"
          kind="reference"
          tone="neutral"
          icon={<StateDot state="running" label="Running" isLive />}
          label={
            <span className="flex min-w-0 items-center gap-1">
              <span className="tabular-nums text-info">{`:${item.port}`}</span>
              <span className="truncate text-foreground">{item.label}</span>
              {item.word === null ? null : (
                <span className="text-faint-foreground">{item.word}</span>
              )}
            </span>
          }
          ariaLabel={`Open :${item.port} ${item.label} in Monitoring`}
          onClick={openMonitoring}
        />
      ))}
      <Button variant="quiet" size="xs" onClick={openMonitoring}>
        {hidden > 0 ? `${hidden} more in Monitoring` : 'All ports of this branch'}
      </Button>
    </div>
  );
};
