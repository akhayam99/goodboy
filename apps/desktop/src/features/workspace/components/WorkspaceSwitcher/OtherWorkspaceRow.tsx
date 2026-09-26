import { AppWindow } from 'lucide-react';
import { Chip, KbdPill, Tooltip, cn } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaceHasUnread } from '../../../../store';
import { linkedProjectsLabel } from '../../linkedProjectsLabel';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { workspaceAccent } from '../../color';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useWorkspaceWindowState } from './useWorkspaceWindowState';

type Props = {
  readonly workspace: Workspace;
  readonly highlighted: boolean;
  readonly onOpen: () => void;
  readonly onOpenNewWindow: () => void;
};

export const OtherWorkspaceRow = ({ workspace, highlighted, onOpen, onOpenNewWindow }: Props) => {
  const windowState = useWorkspaceWindowState({ workspaceId: workspace.id });
  const hasUnread = useWorkspaceHasUnread(workspace.id);
  const projectsLabel = useAppStore((state) =>
    linkedProjectsLabel({ projects: state.projects, workspaceId: workspace.id }),
  );
  const accent = workspaceAccent(workspace.id);
  const lastSeen = workspace.lastAccessedAt ? formatRelativeDuration(workspace.lastAccessedAt) : '';

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
        <span className="flex items-center gap-1.5 truncate text-label text-muted-foreground">
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
          {hasUnread ? <Chip tone="warning" size="3xs" bordered={false} label="unread" /> : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-label text-foreground hover:bg-hover focus-visible:flex group-hover:flex group-focus-within:flex"
      >
        Open
        <KbdPill>↵</KbdPill>
      </button>
      <Tooltip content="Open in new window (⌘↵)">
        <button
          type="button"
          onClick={onOpenNewWindow}
          aria-label="Open in new window"
          className="hidden shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:block group-hover:block"
        >
          <AppWindow size={ICON_SIZE.row} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
};
