import { RotateCcw } from 'lucide-react';
import { Chip, IconButton, StateDot, cn } from '@goodboy/ui';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { CloseTerminal } from './CloseTerminal';
import { TerminalRowName } from './TerminalRowName';

type Props = {
  readonly tab: TerminalTab;
  readonly domId: string;
  readonly isSelected: boolean;
  readonly isBusy: boolean;
  readonly command: string | null;
  readonly isArmed: boolean;
  readonly onSelect: () => void;
  readonly onArm: () => void;
  readonly onDisarm: () => void;
  readonly onClose: () => void;
  readonly onRestart: () => void;
  readonly onRename: (title: string) => Promise<void>;
};

export const TerminalTabItem = ({
  tab,
  domId,
  isSelected,
  isBusy,
  command,
  isArmed,
  onSelect,
  onArm,
  onDisarm,
  onClose,
  onRestart,
  onRename,
}: Props) => {
  const isExited = tab.status === 'exited';
  const isBusyNow = !isExited && isBusy;
  return (
    <div
      data-terminal-tab={tab.id}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('button, input') !== null) {
          return;
        }
        onSelect();
      }}
      className={cn(
        'group flex h-7 max-w-48 shrink-0 items-center gap-2 rounded-md pl-3 pr-1 text-muted-foreground hover:bg-hover',
        isSelected && 'bg-selected text-foreground',
      )}
    >
      {isBusyNow ? <StateDot state="running" label="Running a process" /> : null}
      <TerminalRowName
        id={domId}
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
      {isExited ? (
        <IconButton icon={RotateCcw} label={`Restart ${tab.title}`} size="xs" onClick={onRestart} />
      ) : null}
      <CloseTerminal
        name={tab.title}
        isBusy={isBusyNow}
        isArmed={isArmed}
        command={command}
        onClose={onClose}
        onArm={onArm}
        onDisarm={onDisarm}
      />
    </div>
  );
};
