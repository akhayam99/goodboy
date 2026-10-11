import { TerminalSquare, X } from 'lucide-react';
import { ConfirmPopover, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly name: string;
  readonly isBusy: boolean;
  readonly command: string | null;
  readonly onClose: () => void;
};

type ButtonParams = {
  readonly onClick: () => void;
};

const BUTTON =
  'flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 hover:bg-hover hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100';

export const CloseTerminal = ({ name, isBusy, command, onClose }: Props) => {
  const label = `Close ${name}`;
  const button = ({ onClick }: ButtonParams) => (
    <Tooltip content={label}>
      <button type="button" aria-label={label} onClick={onClick} className={cn(BUTTON)}>
        <X size={ICON_SIZE.row} aria-hidden />
      </button>
    </Tooltip>
  );

  if (!isBusy) {
    return button({ onClick: onClose });
  }

  return (
    <ConfirmPopover
      role="danger"
      icon={<TerminalSquare size={ICON_SIZE.row} aria-hidden />}
      title={
        command === null ? 'A command is running. Close it?' : `${command} is running. Close it?`
      }
      confirmLabel="Close"
      cancelLabel="Keep"
      onConfirm={onClose}
      trigger={({ arm }) => button({ onClick: arm })}
    />
  );
};
