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
      size="xs"
      onClick={onClick}
      className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100"
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
