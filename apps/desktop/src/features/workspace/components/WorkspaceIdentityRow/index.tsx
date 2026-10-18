import { ChevronsUpDown } from 'lucide-react';
import { ROW_INTERACTIVE, cn, AnchoredPopover, StatusDot, useDropdown, Tooltip } from '@goodboy/ui';
import { useAppStore, useCurrentWorkspace, useHasUnreadElsewhere } from '../../../../store';
import { folderCountLabel } from '../../folderCountLabel';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';
import { WorkspaceTile } from '../WorkspaceSwitcher/WorkspaceTile';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export const WorkspaceIdentityRow = () => {
  const currentWorkspace = useCurrentWorkspace();
  const subtitle = useAppStore((state) =>
    folderCountLabel({ projects: state.projects, workspaceId: currentWorkspace?.id ?? null }),
  );
  const hasUnreadElsewhere = useHasUnreadElsewhere(currentWorkspace?.id ?? null);
  const dropdown = useDropdown({
    width: 'w-96',
    expectedWidth: 340,
    expectedHeight: 480,
    openEvent: 'goodboy:open-workspace-switcher',
  });

  if (!currentWorkspace) {
    return null;
  }

  return (
    <div className="ml-(--titlebar-inset) flex w-full min-w-0 items-center gap-0.5">
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Switch or open a workspace"
        anchorClassName="min-w-0"
        hasBackdrop
        trigger={
          <Tooltip
            content={`${currentWorkspace.name}, ${subtitle}`}
            shortcut="workspace.switcher"
            isSuppressed={dropdown.open}
          >
            <button
              type="button"
              onClick={dropdown.toggle}
              data-tauri-drag-region="false"
              aria-label={`Switch workspace: ${currentWorkspace.name}`}
              aria-expanded={dropdown.open}
              className={cn(
                'group flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors',
                ROW_INTERACTIVE,
              )}
            >
              <WorkspaceTile workspace={currentWorkspace} />
              <span className="truncate text-row text-foreground">{currentWorkspace.name}</span>
              {hasUnreadElsewhere ? (
                <StatusDot tone="warning" size="sm" title="Activity in another workspace" />
              ) : null}
              <ChevronsUpDown
                size={ICON_SIZE.row}
                aria-hidden
                className="shrink-0 text-faint-foreground transition-colors group-hover:text-muted-foreground"
              />
            </button>
          </Tooltip>
        }
      >
        <WorkspaceSwitcher onClose={dropdown.close} />
      </AnchoredPopover>
    </div>
  );
};
