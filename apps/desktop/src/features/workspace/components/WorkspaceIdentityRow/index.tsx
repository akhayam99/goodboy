import { ChevronsUpDown, Settings } from 'lucide-react';
import { StatusDot, cn } from '@goodboy/ui';
import { useCurrentWorkspace, useHasUnreadElsewhere } from '../../../../store';
import { workspaceAccent } from '../../color';

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

const basenameOf = (path: string): string => path.replace(/\/+$/, '').split('/').pop() || path;

export type WorkspaceIdentityVariant = 'sidebar' | 'compact';

type Props = {
  readonly variant: WorkspaceIdentityVariant;
};

export const WorkspaceIdentityRow = ({ variant }: Props) => {
  const currentWorkspace = useCurrentWorkspace();
  const hasUnreadElsewhere = useHasUnreadElsewhere(currentWorkspace?.id ?? null);

  if (!currentWorkspace) {
    return null;
  }
  const isSidebar = variant === 'sidebar';
  const accent = workspaceAccent(currentWorkspace.id);
  const memberCount = currentWorkspace.members?.length ?? 0;
  const subtitle = memberCount > 1 ? `${memberCount} repos` : basenameOf(currentWorkspace.rootPath);

  return (
    <div
      className={cn('flex min-w-0 items-center', isSidebar ? 'gap-1' : 'gap-0.5')}
      data-tauri-drag-region="false"
    >
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'))}
        data-tauri-drag-region="false"
        className={cn(
          'group flex min-w-0 items-center rounded-md text-left transition-colors hover:bg-muted/50',
          isSidebar ? 'flex-1 gap-2.5 px-1.5 py-1.5' : 'max-w-56 gap-1.5 px-1.5 py-1',
        )}
        title="Switch or open a workspace"
        aria-label="Switch or open a workspace"
      >
        <span
          aria-hidden
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md font-bold text-primary-foreground shadow-sm',
            isSidebar ? 'size-7 text-xs' : 'size-5 text-[10px]',
          )}
          style={{ backgroundColor: accent }}
        >
          {initialOf(currentWorkspace.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                'truncate font-semibold leading-tight text-foreground',
                isSidebar ? 'text-sm' : 'text-xs',
              )}
            >
              {currentWorkspace.name}
            </span>
            {hasUnreadElsewhere ? (
              <StatusDot tone="warning" size="sm" title="activity in another workspace" />
            ) : null}
          </span>
          {isSidebar ? (
            <span className="truncate text-2xs leading-tight text-muted-foreground/70">
              {subtitle}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown
          size={isSidebar ? 14 : 12}
          aria-hidden
          className="shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
        />
      </button>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-workspace-settings'))}
        data-tauri-drag-region="false"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-foreground',
          isSidebar ? 'size-7' : 'size-6',
        )}
        title={`workspace settings, ${currentWorkspace.name}`}
        aria-label={`open workspace settings for ${currentWorkspace.name}`}
      >
        <Settings size={isSidebar ? 14 : 12} aria-hidden />
      </button>
    </div>
  );
};
