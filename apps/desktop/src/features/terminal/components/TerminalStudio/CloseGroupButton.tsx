import { useState } from 'react';
import { SquareTerminal } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { AnchoredConfirm } from '../../../../shared/components/AnchoredConfirm';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { TerminalGroup } from '../../terminalWorktrees';

type Props = {
  readonly group: TerminalGroup;
  readonly onCloseAll: (group: TerminalGroup) => void;
};

export const CloseGroupButton = ({ group, onCloseAll }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const count = group.worktrees.reduce((total, worktree) => total + worktree.tabs.length, 0);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        Close all
      </Button>
      <AnchoredConfirm
        width="w-96"
        isOpen={isOpen}
        role="alert"
        icon={<SquareTerminal size={ICON_SIZE.row} aria-hidden />}
        title={`Close ${pluralize(count, 'terminal')} of archived sessions?`}
        description="Anything running in them ends. The sessions stay archived."
        confirmLabel="Close all"
        onConfirm={() => {
          onCloseAll(group);
          setIsOpen(false);
        }}
        onCancel={() => setIsOpen(false)}
        isBusy={false}
      />
    </>
  );
};
