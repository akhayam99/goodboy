import { ChevronsUpDown } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  cn,
  ICON_SIZE,
  ROW_INTERACTIVE,
  Skeleton,
  StatusDot,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';
import {
  useAppStore,
  useAttentionElsewhere,
  useCurrentWorkspace,
  useHasUnreadElsewhere,
} from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import { folderCountLabel } from '../../folderCountLabel';
import { needYouWords } from '../../needYouWords';
import { WorkspaceAttentionMark } from '../WorkspaceAttentionMark';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';
import { WorkspaceTile } from '../WorkspaceSwitcher/WorkspaceTile';
import { useWorkspaceSwitchState } from './useWorkspaceSwitchState';

export const WorkspaceIdentityRow = () => {
  const currentWorkspace = useCurrentWorkspace();
  const subtitle = useAppStore((state) =>
    folderCountLabel({ projects: state.projects, workspaceId: currentWorkspace?.id ?? null }),
  );
  const { switchingToName, failedName, retry } = useWorkspaceSwitchState();
  const hasUnreadElsewhere = useHasUnreadElsewhere(currentWorkspace?.id ?? null);
  const elsewhere = useAttentionElsewhere({ currentId: currentWorkspace?.id ?? null });
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
    <div className="relative ml-(--titlebar-inset) flex w-full min-w-0 items-center gap-0.5">
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Switch or open a workspace"
        anchorClassName="min-w-0"
        hasBackdrop
        trigger={
          <Tooltip
            content={
              elsewhere.count > 0
                ? `${currentWorkspace.name}, ${subtitle}. ${needYouWords({ count: elsewhere.count })} in other workspaces`
                : hasUnreadElsewhere
                  ? `${currentWorkspace.name}, ${subtitle}. Activity in another workspace`
                  : `${currentWorkspace.name}, ${subtitle}`
            }
            shortcut="workspace.switcher"
            isSuppressed={dropdown.open}
          >
            <button
              type="button"
              onClick={dropdown.toggle}
              data-tauri-drag-region="false"
              aria-label={
                elsewhere.count === 0
                  ? `Switch workspace: ${currentWorkspace.name}`
                  : `Switch workspace: ${currentWorkspace.name}, ${needYouWords({ count: elsewhere.count })} in other workspaces`
              }
              aria-expanded={dropdown.open}
              className={cn(
                'group flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors',
                ROW_INTERACTIVE,
              )}
            >
              <WorkspaceTile workspace={currentWorkspace} />
              <span
                className={cn(
                  'truncate text-row',
                  switchingToName === null ? 'text-foreground' : 'text-muted-foreground',
                )}
                aria-busy={switchingToName !== null}
              >
                {switchingToName ?? currentWorkspace.name}
              </span>
              {switchingToName !== null ? <Skeleton className="h-3 w-8 shrink-0" /> : null}
              {elsewhere.tone !== null ? (
                <WorkspaceAttentionMark
                  count={elsewhere.count}
                  tone={elsewhere.tone}
                  variant="pill"
                />
              ) : null}
              {hasUnreadElsewhere ? <StatusDot tone="warning" size="sm" /> : null}
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
      {failedName !== null ? (
        <div
          role="alert"
          className="absolute top-full left-0 z-10 flex items-center gap-2 text-meta text-danger"
        >
          <span>{`Couldn't open ${failedName}.`}</span>
          <Button size="sm" variant="ghost" onClick={retry}>
            {NAMES.retry}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
