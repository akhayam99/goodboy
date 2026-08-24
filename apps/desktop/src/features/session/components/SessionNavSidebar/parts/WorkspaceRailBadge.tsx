import { AnchoredPopover, Tooltip, useDropdown } from '@goodboy/ui';
import { useCurrentWorkspace } from '../../../../../store';
import { workspaceAccent } from '../../../../workspace/color';
import { WorkspaceSwitcher } from '../../../../workspace/components/WorkspaceSwitcher';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

export const WorkspaceRailBadge = () => {
  const currentWorkspace = useCurrentWorkspace();
  const dropdown = useDropdown({
    width: 'w-[340px]',
    expectedWidth: 340,
    expectedHeight: 480,
    openEvent: 'goodboy:open-workspace-switcher',
  });

  if (!currentWorkspace) {
    return null;
  }
  const label = `${currentWorkspace.name}, switch workspace (${shortcutGlyphs('workspace.switcher')})`;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Switch or open a workspace"
      anchorClassName="shrink-0"
      hasBackdrop
      trigger={
        <Tooltip content={label} side="right">
          <button
            type="button"
            onClick={dropdown.toggle}
            aria-label={label}
            aria-expanded={dropdown.open}
            className="flex size-8 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <span
              aria-hidden
              className="flex size-5 items-center justify-center rounded-md text-3xs font-bold text-primary-foreground"
              style={{ backgroundColor: workspaceAccent(currentWorkspace.id) }}
            >
              {initialOf(currentWorkspace.name)}
            </span>
          </button>
        </Tooltip>
      }
    >
      <WorkspaceSwitcher onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
