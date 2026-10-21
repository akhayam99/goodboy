import { AppWindow } from 'lucide-react';
import { IconButton, Kbd, ROW_INTERACTIVE, StatusDot, cn } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaceHasUnread } from '../../../../store';
import { folderCountLabel } from '../../folderCountLabel';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs, type ShortcutId } from '../../../../shared/keyboard/registry';
import { useWorkspaceWindowState } from './useWorkspaceWindowState';
import { useNow } from '../../../../shared/hooks/useNow';
import { WorkspaceTile } from './WorkspaceTile';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';

type Props = {
  readonly workspace: Workspace;
  readonly highlighted: boolean;
  readonly digitShortcut: ShortcutId | null;
  readonly onOpen: () => void;
  readonly onOpenNewWindow: () => void;
};

export const OtherWorkspaceRow = ({
  workspace,
  highlighted,
  digitShortcut,
  onOpen,
  onOpenNewWindow,
}: Props) => {
  const now = useNow(30_000);
  const windowState = useWorkspaceWindowState({ workspaceId: workspace.id });
  const hasUnread = useWorkspaceHasUnread(workspace.id);
  const projectsLabel = useAppStore((state) =>
    folderCountLabel({ projects: state.projects, workspaceId: workspace.id }),
  );
  const lastSeen = workspace.lastAccessedAt
    ? formatSpan({ from: workspace.lastAccessedAt, to: now })
    : '';
  const subtitle =
    windowState === 'other-window'
      ? 'In another window'
      : `${projectsLabel} · ${lastSeen === '' ? 'never opened' : lastSeen}`;

  const menu = useObjectMenuTrigger({
    target: { kind: 'workspace', facts: { name: workspace.name, onOpen, onOpenNewWindow } },
    anchorKey: `workspace-row:${workspace.id}`,
  });

  return (
    <div
      data-workspace-row={workspace.name}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-md pr-1',
        highlighted ? 'bg-hover' : 'hover:bg-hover',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Switch to ${workspace.name}`}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left',
          ROW_INTERACTIVE,
        )}
      >
        <WorkspaceTile workspace={workspace} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-row text-foreground">{workspace.name}</span>
          <span className="flex min-w-0 items-center gap-1 text-meta text-muted-foreground">
            {windowState === 'other-window' ? (
              <AppWindow size={ICON_SIZE.mark} aria-hidden className="shrink-0" />
            ) : null}
            <span className="truncate">{subtitle}</span>
          </span>
        </span>
        {hasUnread ? <StatusDot tone="warning" size="sm" title="Unread activity" /> : null}
        {digitShortcut === null ? null : <Kbd>{shortcutGlyphs(digitShortcut)}</Kbd>}
      </button>
      <IconButton
        icon={AppWindow}
        label={`Open ${workspace.name} in a new window`}
        tooltip="Open in new window"
        shortcut="composer.submit"
        size="xs"
        iconSize={ICON_SIZE.row}
        onClick={onOpenNewWindow}
      />
    </div>
  );
};
