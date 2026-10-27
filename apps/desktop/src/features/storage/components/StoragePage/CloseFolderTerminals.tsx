import { useState } from 'react';
import { SquareTerminal } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { AnchoredConfirm } from '../../../../shared/components/AnchoredConfirm';
import { useAppStore } from '../../../../store';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { forgetTerminalCommand } from '../../../terminal/commandTracker';
import { pluralize } from '../../../../shared/utils/pluralize';

type Props = {
  readonly terminals: ReadonlyArray<TerminalTab>;
};

const terminalTitlesOf = ({ terminals }: Props): string =>
  terminals.map((tab) => tab.title).join(', ');

export const CloseFolderTerminals = ({ terminals }: Props) => {
  const closeTerminalTab = useAppStore((state) => state.closeTerminalTab);
  const [isOpen, setIsOpen] = useState(false);

  const onConfirm = () => {
    for (const tab of terminals) {
      forgetTerminalCommand({ terminalId: tab.id });
      closeTerminalTab({ owner: tab.owner, tabId: tab.id });
    }
    setIsOpen(false);
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        <SquareTerminal size={ICON_SIZE.row} aria-hidden />
        Close {pluralize(terminals.length, 'terminal')}
      </Button>
      <AnchoredConfirm
        width="w-96"
        isOpen={isOpen}
        role="alert"
        icon={<SquareTerminal size={ICON_SIZE.row} aria-hidden />}
        title={`Close ${pluralize(terminals.length, 'terminal')} in this folder?`}
        description={`Stops ${terminalTitlesOf({ terminals })}. Running commands end.`}
        confirmLabel="Close terminals"
        onConfirm={onConfirm}
        onCancel={() => setIsOpen(false)}
        isBusy={false}
      />
    </>
  );
};
