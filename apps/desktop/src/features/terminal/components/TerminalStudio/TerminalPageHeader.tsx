import { Button, PageHeader } from '@goodboy/ui';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { dockTerminalPage } from '../../dockTerminalPage';

type Props = {
  readonly selected: TerminalTab | null;
};

export const TerminalPageHeader = ({ selected }: Props) => (
  <PageHeader
    page="terminal"
    title="Terminal"
    actions={
      selected === null ? undefined : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            dockTerminalPage({
              terminalId: selected.id,
              sessionId: selected.owner.kind === 'session' ? selected.owner.sessionId : null,
            })
          }
        >
          Dock
        </Button>
      )
    }
  />
);
