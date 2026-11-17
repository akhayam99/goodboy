import { AnchoredPopover, POPOVER_WIDTH_CLASS, POPOVER_WIDTH_PX, useDropdown } from '@goodboy/ui';
import { useCurrentWorkspace } from '../../../../store';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { SessionsPanel } from './SessionsPanel';
import { SessionsTrigger } from './SessionsTrigger';

const EXPECTED_HEIGHT_PX = 640;

export const SessionsPopover = () => {
  const workspace = useCurrentWorkspace();
  const dropdown = useDropdown({
    align: 'start',
    width: POPOVER_WIDTH_CLASS.studio,
    expectedWidth: POPOVER_WIDTH_PX.studio,
    expectedHeight: EXPECTED_HEIGHT_PX,
  });
  const { close, toggle } = dropdown;
  const hasWorkspace = workspace !== null && workspace !== undefined;
  useShortcut('sessions.toggle', toggle, hasWorkspace);
  if (!hasWorkspace) {
    return null;
  }
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Sessions"
      className="overflow-y-hidden"
      trigger={<SessionsTrigger isOpen={dropdown.open} onToggle={toggle} />}
    >
      <SessionsPanel workspaceId={workspace.id} onClose={close} />
    </AnchoredPopover>
  );
};
