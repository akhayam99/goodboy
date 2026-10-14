import { TerminalSquare, X } from 'lucide-react';
import { ConfirmPopover, IconButton } from '@goodboy/ui';
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

export const CloseTerminal = ({ name, isBusy, command, onClose }: Props) => {
  const label = `Close ${name}`;
  const button = ({ onClick }: ButtonParams) => (
    <IconButton
      icon={X}
      label={label}
      size="sm"
      onClick={onClick}
      className="shrink-0 text-faint-foreground hover:text-foreground aria-expanded:text-foreground"
    />
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
