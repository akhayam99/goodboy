import { DockButton } from '../../../../shared/components/DockButton';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { dockEmptyTerminalPage } from '../../dockEmptyTerminalPage';
import { dockTerminalPage } from '../../dockTerminalPage';

type Props = {
  readonly selected: TerminalTab | null;
};

export const DockTerminalButton = ({ selected }: Props) => (
  <DockButton
    tooltip="Dock the terminal beside the page"
    onDock={() => {
      if (selected === null) {
        dockEmptyTerminalPage({});
        return;
      }
      dockTerminalPage({
        terminalId: selected.id,
        sessionId: selected.owner.kind === 'session' ? selected.owner.sessionId : null,
      });
    }}
  />
);
