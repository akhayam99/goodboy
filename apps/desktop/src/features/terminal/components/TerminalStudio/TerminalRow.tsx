import { RotateCcw } from 'lucide-react';
import { Button, Chip, ICON_SIZE, ROW_HOVER, StatusDot, cn, type Tone } from '@goodboy/ui';
import type { TerminalTab } from '../../../../shared/types/terminal';
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

type StateParams = {
  readonly tab: TerminalTab;
  readonly isBusy: boolean;
};

type Presentation = {
  readonly label: string;
  readonly tone: Tone;
  readonly isPulsing: boolean;
};

const presentationOf = ({ tab, isBusy }: StateParams): Presentation => {
  if (tab.status === 'exited') {
    return { label: 'Exited', tone: 'neutral', isPulsing: false };
  }
  if (isBusy) {
    return { label: 'Busy', tone: 'warning', isPulsing: true };
  }
  return { label: 'Idle', tone: 'success', isPulsing: false };
};

export const TerminalRow = ({
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
  const presentation = presentationOf({ tab, isBusy });
  const detail = isExited
    ? `exited ${tab.exitCode ?? 0}`
    : isBusyNow
      ? (command ?? 'running')
      : null;
  return (
    <li
      data-terminal-row={tab.id}
      className={cn(
        'group flex min-h-8 items-center gap-2 rounded-md px-2 text-muted-foreground',
        ROW_HOVER,
        isSelected && 'bg-selected text-foreground',
      )}
    >
      <StatusDot
        tone={presentation.tone}
        size="md"
        pulsing={presentation.isPulsing}
        role="status"
        ariaLabel={presentation.label}
      />
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <TerminalRowName
          name={tab.title}
          isSelected={isSelected}
          onSelect={onSelect}
          onRename={onRename}
        />
        {detail === null ? null : (
          <span className="truncate text-meta text-faint-foreground">{detail}</span>
        )}
      </div>
      {ports.map((port) => (
        <Chip key={port} tone="neutral" kind="reference" size="xs" label={`:${port}`} />
      ))}
      {isExited ? (
        <Button size="xs" variant="ghost" onClick={onRestart}>
          <RotateCcw size={ICON_SIZE.row} aria-hidden />
          Restart
        </Button>
      ) : null}
      <CloseTerminal name={tab.title} isBusy={isBusyNow} command={command} onClose={onClose} />
    </li>
  );
};
