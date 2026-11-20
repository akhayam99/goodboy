import {
  AnchoredLayer,
  AnchoredPopover,
  Button,
  cn,
  FLOATING_SURFACE,
  SHELL_RAIL_POPOVER,
  ShellRailItem,
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
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';
import { useWorkspaceSwitchState } from './useWorkspaceSwitchState';
import { WorkspaceTileGlyph } from './WorkspaceTileGlyph';
import { workspaceMarkOf } from './workspaceMarkOf';

export const WorkspaceIdentityRow = () => {
  const currentWorkspace = useCurrentWorkspace();
  const subtitle = useAppStore((state) =>
    folderCountLabel({ projects: state.projects, workspaceId: currentWorkspace?.id ?? null }),
  );
  const { switchingToName, failedName, retry } = useWorkspaceSwitchState();
  const hasUnreadElsewhere = useHasUnreadElsewhere(currentWorkspace?.id ?? null);
  const elsewhere = useAttentionElsewhere({ currentId: currentWorkspace?.id ?? null });
  const dropdown = useDropdown({
    ...SHELL_RAIL_POPOVER,
    width: 'w-96',
    expectedWidth: 340,
    expectedHeight: 480,
    openEvent: 'goodboy:open-workspace-switcher',
  });

  if (!currentWorkspace) {
    return null;
  }

  const mark = workspaceMarkOf({
    count: elsewhere.count,
    tone: elsewhere.tone,
    hasUnreadElsewhere,
  });

  return (
    <div data-workspace-mark="" className="w-full">
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Switch or open a workspace"
        anchorClassName="w-full"
        hasBackdrop
        bodyClassName="max-h-96"
        trigger={
          <ShellRailItem
            id="workspace"
            icon={WorkspaceTileGlyph}
            label={`Switch workspace: ${currentWorkspace.name}`}
            word={switchingToName ?? currentWorkspace.name}
            tooltip={`${currentWorkspace.name}, ${subtitle}`}
            shortcut="workspace.switcher"
            mark={mark}
            hasPopup="dialog"
            isExpanded={dropdown.open}
            isBusy={switchingToName !== null}
            onSelect={dropdown.toggle}
          />
        }
      >
        <WorkspaceSwitcher onClose={dropdown.close} />
      </AnchoredPopover>
      {failedName !== null ? (
        <AnchoredLayer side="right" className={cn(FLOATING_SURFACE, 'px-2 py-1')}>
          <div role="alert" className="flex items-center gap-2 text-meta text-danger">
            <span>{`Couldn't open ${failedName}.`}</span>
            <Button size="sm" variant="ghost" onClick={retry}>
              {NAMES.retry}
            </Button>
          </div>
        </AnchoredLayer>
      ) : null}
    </div>
  );
};
