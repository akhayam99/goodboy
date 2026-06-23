import { ChevronsUpDown, Settings } from 'lucide-react';
import { useCurrentWorkspace, useHasUnreadElsewhere } from '../../../../store';
import { workspaceAccent } from '../../color';

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

const basenameOf = (path: string): string => path.replace(/\/+$/, '').split('/').pop() || path;

export const WorkspaceHeader = () => {
  const currentWorkspace = useCurrentWorkspace();
  const hasUnreadElsewhere = useHasUnreadElsewhere(currentWorkspace?.id ?? null);

  if (!currentWorkspace) {
    return null;
  }
  const accent = workspaceAccent(currentWorkspace.id);
  const memberCount = currentWorkspace.members?.length ?? 0;
  const subtitle = memberCount > 1 ? `${memberCount} repos` : basenameOf(currentWorkspace.rootPath);

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
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full bg-warning"
                title="activity in another workspace"
              />
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
