import { ChevronsUpDown, Settings } from 'lucide-react';
import { useCurrentWorkspace, useHasUnreadElsewhere } from '../../../../store';
import { workspaceAccent } from '../../color';

export const WorkspaceHeader = () => {
  const currentWorkspace = useCurrentWorkspace();
  const hasUnreadElsewhere = useHasUnreadElsewhere(currentWorkspace?.id ?? null);

  if (!currentWorkspace) {
    return null;
  }
  const accent = workspaceAccent(currentWorkspace.id);

  return (
    <div className="shrink-0 px-3 py-2" data-tauri-drag-region="false">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-4 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'))}
          data-tauri-drag-region="false"
          className="group flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
          title="Switch or open a workspace"
          aria-label="Switch or open a workspace"
        >
          <span className="truncate text-xs font-semibold text-foreground">
            {currentWorkspace.name}
          </span>
          {hasUnreadElsewhere ? (
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-warning"
              title="activity in another workspace"
            />
          ) : null}
          <ChevronsUpDown
            size={13}
            aria-hidden
            className="shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
          />
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-workspace-settings'))}
          data-tauri-drag-region="false"
          className="flex shrink-0 items-center p-1 text-muted-foreground/50 transition-colors hover:text-foreground"
          title={`workspace settings, ${currentWorkspace.name}`}
          aria-label={`open workspace settings for ${currentWorkspace.name}`}
        >
          <Settings size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
};
