import { Button, PageHeader } from '@goodboy/ui';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { dockEmptyTerminalPage } from '../../dockEmptyTerminalPage';
import { dockTerminalPage } from '../../dockTerminalPage';

type Props = {
  readonly selected: TerminalTab | null;
};

export const TerminalPageHeader = ({ selected }: Props) => (
  <PageHeader
    page="terminal"
    title="Terminal"
    actions={
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          if (selected === null) {
            dockEmptyTerminalPage({});
            return;
          }
          dockTerminalPage({
            terminalId: selected.id,
            sessionId: selected.owner.kind === 'session' ? selected.owner.sessionId : null,
          });
        }}
      >
        Dock
      </Button>
    }
  />
);
