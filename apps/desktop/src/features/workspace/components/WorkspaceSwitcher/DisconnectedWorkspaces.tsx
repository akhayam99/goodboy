import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { Workspace, WorkspaceId } from '@goodboy/types';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { workspaceAccent } from '../../color';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly onReconnect: (id: WorkspaceId) => void;
};

export const DisconnectedWorkspaces = ({ workspaces, onReconnect }: Props) => {
  const now = useNow(30_000);
  const [open, setOpen] = useState(false);

  if (workspaces.length === 0) {
    return null;
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-label text-muted-foreground hover:bg-hover hover:text-foreground"
      >
        {open ? (
          <ChevronDown size={ICON_SIZE.control} aria-hidden />
        ) : (
          <ChevronRight size={ICON_SIZE.control} aria-hidden />
        )}
        Disconnected
        <span className="text-faint-foreground">{workspaces.length}</span>
      </button>
      {open
        ? workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="flex items-center gap-3 rounded-md px-3 py-2 opacity-60"
            >
              <span
                aria-hidden
                className="h-7 w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: workspaceAccent(workspace.id) }}
              />
              <span className="min-w-0 flex-1">
                <span className="truncate text-row text-foreground">{workspace.name}</span>
                <span className="block truncate text-label text-muted-foreground">
                  Disconnected{' '}
                  {workspace.disconnectedAt
                    ? formatSpan({ from: workspace.disconnectedAt, to: now })
                    : ''}
                </span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onReconnect(workspace.id)}
                className="shrink-0"
              >
                Reconnect
              </Button>
            </div>
          ))
        : null}
    </div>
  );
};
