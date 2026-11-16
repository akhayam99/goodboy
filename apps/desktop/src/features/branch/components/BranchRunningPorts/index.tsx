import { Button, Chip, StateDot, Tooltip } from '@goodboy/ui';
import type { Session, SessionProjectMount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openWebLink } from '../../../browser/openWebLink';
import { ownBrowserClickWord } from '../../../browser/ownBrowserClickWord';
import { useRunningHere } from '../../hooks/useRunningHere';

const SHOWN = 2;

type Props = {
  readonly session: Pick<Session, 'id' | 'workspaceId'>;
  readonly mount: Pick<SessionProjectMount, 'projectId' | 'branch'> | null;
  readonly isActive?: boolean;
};

export const BranchRunningPorts = ({ session, mount, isActive = true }: Props) => {
  const openStudio = useAppStore((state) => state.openStudio);
  const { target, items } = useRunningHere({
    workspaceId: session.workspaceId,
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
    <span data-branch-ports="" className="inline-flex min-w-0 items-center gap-2">
      <span aria-hidden>·</span>
      {items.slice(0, SHOWN).map((item) => {
        const open = `Open localhost:${item.port} beside the session. ${ownBrowserClickWord()} opens your browser`;
        return (
          <Chip
            key={item.key}
            as="button"
            kind="reference"
            tone="neutral"
            emphasis="subtle"
            bordered={false}
            className="h-4 rounded-sm px-1"
            icon={<StateDot state="running" label="Running" isLive />}
            label={
              <span className="flex min-w-0 items-center gap-1">
                <span className="text-code tabular-nums text-foreground">{`:${item.port}`}</span>
                <span className="max-w-32 truncate">{item.label}</span>
              </span>
            }
            title={item.word === null ? open : `${item.word} opened it. ${open}`}
            ariaLabel={`Open localhost:${item.port}`}
            onClick={(event) =>
              void openWebLink({
                sessionId: session.id,
                url: `http://localhost:${item.port}`,
                event,
              })
            }
          />
        );
      })}
      <Tooltip content="Open Monitoring on this branch" anchorClassName="shrink-0">
        <Button variant="quiet" size="xs" className="h-4 px-1" onClick={openMonitoring}>
          {hidden > 0 ? `+${hidden} more` : 'Ports'}
        </Button>
      </Tooltip>
    </span>
  );
};
