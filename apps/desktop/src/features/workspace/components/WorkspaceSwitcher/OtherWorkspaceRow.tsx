import { AppWindow } from 'lucide-react';
import { Chip, Kbd, cn, IconButton } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaceHasUnread } from '../../../../store';
import { linkedProjectsLabel } from '../../linkedProjectsLabel';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { workspaceAccent } from '../../color';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs, type ShortcutId } from '../../../../shared/keyboard/registry';
import { useWorkspaceWindowState } from './useWorkspaceWindowState';
import { useNow } from '../../../../shared/hooks/useNow';

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
    linkedProjectsLabel({ projects: state.projects, workspaceId: workspace.id }),
  );
  const accent = workspaceAccent(workspace.id);
  const lastSeen = workspace.lastAccessedAt
    ? formatSpan({ from: workspace.lastAccessedAt, to: now })
    : '';

  return (
    <div
      className={cn(
        'group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
        highlighted
          ? 'border-border bg-muted'
          : 'border-transparent hover:border-border-soft hover:bg-hover',
      )}
    >
      <span
        aria-hidden
        className="h-7 w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="truncate text-row text-foreground">{workspace.name}</span>
        <span className="flex items-center gap-2 truncate text-label text-muted-foreground">
          {windowState === 'other-window' ? (
            <>
              <AppWindow size={ICON_SIZE.control} aria-hidden />
              In another window
            </>
          ) : (
            <>
              {projectsLabel} · {lastSeen || 'never opened'}
            </>
          )}
          {hasUnread ? <Chip tone="warning" kind="state" bordered={false} label="unread" /> : null}
        </span>
      </button>
      {digitShortcut === null ? null : (
        <span className="shrink-0 group-hover:hidden group-focus-within:hidden">
          <Kbd>{shortcutGlyphs(digitShortcut)}</Kbd>
        </span>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="hidden shrink-0 items-center gap-2 rounded-md px-2 py-1 text-label text-foreground hover:bg-hover focus-visible:flex group-hover:flex group-focus-within:flex"
      >
        Open
        <Kbd look="cap">↵</Kbd>
      </button>
      <IconButton
        icon={AppWindow}
        label="Open in new window"
        shortcut="composer.submit"
        size="sm"
        iconSize={ICON_SIZE.row}
        onClick={onOpenNewWindow}
        className="hidden focus-visible:inline-flex group-hover:inline-flex"
      />
    </div>
  );
};
