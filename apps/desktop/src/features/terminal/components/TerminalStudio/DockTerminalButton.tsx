import { DockButton } from '../../../../shared/components/DockButton';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { dockEmptyTerminalPage } from '../../dockEmptyTerminalPage';
import { dockTerminalPage } from '../../dockTerminalPage';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly selected: TerminalTab | null;
};

export const DockTerminalButton = ({ selected }: Props) => (
  <DockButton
    tooltip={NAMES.dockBesideThePage}
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
