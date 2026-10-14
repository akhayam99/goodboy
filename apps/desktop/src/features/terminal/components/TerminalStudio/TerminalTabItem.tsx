import { RotateCcw } from 'lucide-react';
import { Chip, IconButton, StatusDot, cn } from '@goodboy/ui';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { PortChip } from '../PortChip';
import { CloseTerminal } from './CloseTerminal';
import { TerminalRowName } from './TerminalRowName';

type Props = {
  readonly tab: TerminalTab;
  readonly isSelected: boolean;
  readonly isBusy: boolean;
  readonly command: string | null;
  readonly ports: ReadonlyArray<number>;
  readonly onSelect: () => void;
  readonly onClose: () => void;
  readonly onRestart: () => void;
  readonly onRename: (title: string) => Promise<void>;
};

export const TerminalTabItem = ({
  tab,
  isSelected,
  isBusy,
  command,
  ports,
  onSelect,
  onClose,
  onRestart,
  onRename,
}: Props) => {
  const isExited = tab.status === 'exited';
  const isBusyNow = !isExited && isBusy;
  return (
    <div
      data-terminal-tab={tab.id}
      className={cn(
        'group flex h-7 max-w-48 shrink-0 items-center gap-2 rounded-md pl-3 pr-1 text-muted-foreground hover:bg-hover',
        isSelected && 'bg-selected text-foreground',
      )}
    >
      {isBusyNow ? (
        <StatusDot tone="warning" size="sm" pulsing role="status" ariaLabel="Busy" />
      ) : null}
      <TerminalRowName
        name={tab.title}
        isSelected={isSelected}
        isTab
        onSelect={onSelect}
        onRename={onRename}
      />
      {isExited ? (
        <Chip
          tone="danger"
          kind="state"
          size="3xs"
          label={tab.openError === undefined ? 'exited' : 'failed'}
        />
      ) : null}
      {ports.map((port) => (
        <PortChip key={port} port={port} />
      ))}
      {isExited ? (
        <IconButton icon={RotateCcw} label={`Restart ${tab.title}`} size="xs" onClick={onRestart} />
      ) : null}
      <CloseTerminal name={tab.title} isBusy={isBusyNow} command={command} onClose={onClose} />
    </div>
  );
};
