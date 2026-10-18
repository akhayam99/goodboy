import { AppWindow, Unplug } from 'lucide-react';
import { ConfirmPopover, IconButton, InteractiveRow, StatusDot } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaceHasUnread } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatAdaptiveAge } from '../../../../shared/utils/time/formatAdaptiveAge';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { useNow } from '../../../../shared/hooks/useNow';
import { folderCountLabel } from '../../folderCountLabel';
import { workspaceFolderPath } from '../../workspaceFolderPath';
import { WorkspaceTile } from '../WorkspaceSwitcher/WorkspaceTile';

type Props = {
  readonly workspace: Workspace;
  readonly home: string | null;
  readonly onOpen: () => void;
  readonly onOpenNewWindow: () => void;
  readonly onDisconnect: () => void;
};

export const WorkspaceRow = ({ workspace, home, onOpen, onOpenNewWindow, onDisconnect }: Props) => {
  const now = useNow(30_000);
  const hasUnread = useWorkspaceHasUnread(workspace.id);
  const folders = useAppStore((state) =>
    folderCountLabel({ projects: state.projects, workspaceId: workspace.id }),
  );
  const path = useAppStore((state) =>
    workspaceFolderPath({ projects: state.projects, workspaceId: workspace.id, home }),
  );
  const lastSeen =
    workspace.lastAccessedAt === undefined
      ? ''
      : formatAdaptiveAge({ at: workspace.lastAccessedAt, now });

  return (
    <li data-workspace-row={workspace.name} className="bg-subtle">
      <InteractiveRow
        label={`Open ${workspace.name}`}
        isSelected={false}
        onOpen={onOpen}
        frameClassName="rounded-none"
        className="flex min-h-14 items-center gap-3 py-2 pl-4 pr-3"
      >
        <WorkspaceTile workspace={workspace} className="size-6" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-row text-foreground">{workspace.name}</span>
            {hasUnread ? <StatusDot tone="warning" size="sm" title="Unread activity" /> : null}
          </span>
          <span className="truncate text-meta text-faint-foreground">
            {joinFacts({ facts: [folders, path] })}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <IconButton
            icon={AppWindow}
            label={`Open ${workspace.name} in a new window`}
            tooltip="Open in a new window"
            variant="ghost"
            size="xs"
            iconSize={ICON_SIZE.row}
            onClick={onOpenNewWindow}
            className="text-faint-foreground"
          />
          <ConfirmPopover
            role="danger"
            icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
            title={`Disconnect ${workspace.name}?`}
            description="Hides this workspace. Its folders and sessions stay; open its folder to reconnect."
            confirmLabel="Disconnect workspace"
            onConfirm={onDisconnect}
            anchorClassName="flex"
            returnFocusTo={{ rowSelector: 'li' }}
            trigger={({ arm, isArmed }) => (
              <IconButton
                icon={Unplug}
                label={`Disconnect ${workspace.name}`}
                tooltip={`Disconnect ${workspace.name}`}
                variant="ghost"
                size="xs"
                iconSize={ICON_SIZE.row}
                onClick={arm}
                className={isArmed ? 'text-danger' : 'text-faint-foreground'}
              />
            )}
          />
        </span>
        <span className="w-20 shrink-0 text-right text-meta text-faint-foreground tabular-nums">
          {lastSeen}
        </span>
      </InteractiveRow>
    </li>
  );
};
