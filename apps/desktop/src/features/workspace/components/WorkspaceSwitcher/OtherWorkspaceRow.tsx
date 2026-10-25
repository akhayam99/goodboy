import { AppWindow } from 'lucide-react';
import { cn, ICON_SIZE, IconButton, Kbd, ROW_INTERACTIVE, StatusDot } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaceAttentionEntry } from '../../../../store';
import { folderCountLabel } from '../../folderCountLabel';
import { NEW_WINDOW_TOOLTIP } from '../../newWindowTooltip';
import { useWorkspaceRowFacts } from '../../hooks/useWorkspaceRowFacts';
import { needYouWords } from '../../needYouWords';
import { WorkspaceAttentionMark } from '../WorkspaceAttentionMark';

import { shortcutGlyphs, type ShortcutId } from '../../../../shared/keyboard/registry';
import { useWorkspaceWindowState } from './useWorkspaceWindowState';
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
  const windowState = useWorkspaceWindowState({ workspaceId: workspace.id });
  const { lastSeen, hasUnread } = useWorkspaceRowFacts({ workspace });
  const projectsLabel = useAppStore((state) =>
    folderCountLabel({ projects: state.projects, workspaceId: workspace.id }),
  );
  const attention = useWorkspaceAttentionEntry({ workspaceId: workspace.id });
  const quietSubtitle =
    windowState === 'other-window'
      ? 'In another window'
      : `${projectsLabel} · ${lastSeen === '' ? 'never opened' : lastSeen}`;
  const subtitle =
    attention === null || attention.reasonWords.length === 0
      ? quietSubtitle
      : attention.reasonWords.join(', ');
  const switchLabel =
    attention === null
      ? `Switch to ${workspace.name}`
      : `Switch to ${workspace.name}, ${needYouWords({ count: attention.count })}`;

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
        aria-label={switchLabel}
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
        {attention === null ? null : (
          <WorkspaceAttentionMark count={attention.count} tone={attention.tone} variant="words" />
        )}
        {hasUnread ? <StatusDot tone="warning" size="sm" title="Unread activity" /> : null}
        {digitShortcut === null ? null : <Kbd>{shortcutGlyphs(digitShortcut)}</Kbd>}
      </button>
      <IconButton
        icon={AppWindow}
        label={`Open ${workspace.name} in a new window`}
        tooltip={NEW_WINDOW_TOOLTIP}
        shortcut="composer.submit"
        size="xs"
        iconSize={ICON_SIZE.row}
        onClick={onOpenNewWindow}
      />
    </div>
  );
};
