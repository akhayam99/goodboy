import { ChevronsUpDown, PanelLeft, PanelLeftClose, Settings } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import { useCurrentWorkspace, useHasUnreadElsewhere } from '../../../../store';
import { workspaceAccent } from '../../color';

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

const basenameOf = (path: string): string => path.replace(/\/+$/, '').split('/').pop() || path;

type LabelParams = {
  readonly hasActiveSession: boolean;
  readonly isSessionSidebarCollapsed: boolean;
};

const sidebarActionLabelFor = ({
  hasActiveSession,
  isSessionSidebarCollapsed,
}: LabelParams): string => {
  if (!hasActiveSession) {
    return 'open a session to show the sessions column';
  }
  if (isSessionSidebarCollapsed) {
    return 'show sessions column (⌘B)';
  }
  return 'hide sessions column (⌘B)';
};

type Props = {
  readonly hasActiveSession: boolean;
  readonly isSessionSidebarCollapsed: boolean;
  readonly onToggleSessionSidebar: () => void;
};

export const WorkspaceHeader = ({
  hasActiveSession,
  isSessionSidebarCollapsed,
  onToggleSessionSidebar,
}: Props) => {
  const currentWorkspace = useCurrentWorkspace();
  const hasUnreadElsewhere = useHasUnreadElsewhere(currentWorkspace?.id ?? null);

  if (!currentWorkspace) {
    return null;
  }
  const accent = workspaceAccent(currentWorkspace.id);
  const memberCount = currentWorkspace.members?.length ?? 0;
  const subtitle = memberCount > 1 ? `${memberCount} repos` : basenameOf(currentWorkspace.rootPath);
  const sidebarActionDisabled = !hasActiveSession;
  const sidebarActionLabel = sidebarActionLabelFor({
    hasActiveSession,
    isSessionSidebarCollapsed,
  });

  return (
    <div className="flex shrink-0 items-center gap-1 px-2.5 py-2.5" data-tauri-drag-region="false">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'))}
        data-tauri-drag-region="false"
        className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-muted/50"
        title="Switch or open a workspace"
        aria-label="Switch or open a workspace"
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-primary-foreground shadow-sm"
          style={{ backgroundColor: accent }}
        >
          {initialOf(currentWorkspace.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold leading-tight text-foreground">
              {currentWorkspace.name}
            </span>
            {hasUnreadElsewhere ? (
              <StatusDot tone="warning" size="sm" title="activity in another workspace" />
            ) : null}
          </span>
          <span className="truncate text-2xs leading-tight text-muted-foreground/70">
            {subtitle}
          </span>
        </span>
        <ChevronsUpDown
          size={14}
          aria-hidden
          className="shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
        />
      </button>
      <button
        type="button"
        onClick={onToggleSessionSidebar}
        disabled={sidebarActionDisabled}
        data-tauri-drag-region="false"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        title={sidebarActionLabel}
        aria-label={sidebarActionLabel}
      >
        {isSessionSidebarCollapsed ? (
          <PanelLeft size={14} aria-hidden />
        ) : (
          <PanelLeftClose size={14} aria-hidden />
        )}
      </button>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-workspace-settings'))}
        data-tauri-drag-region="false"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-foreground"
        title={`workspace settings, ${currentWorkspace.name}`}
        aria-label={`open workspace settings for ${currentWorkspace.name}`}
      >
        <Settings size={14} aria-hidden />
      </button>
    </div>
  );
};
