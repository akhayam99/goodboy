import { Button } from '@goodboy/ui';
import { TERMINAL_PICKER_EVENTS } from '../../terminalPickerEvents';

type Props = {
  readonly note: string;
};

export const TerminalElsewhereNote = ({ note }: Props) => (
  <div className="flex min-w-0 px-2">
    <Button
      variant="fact"
      size="xs"
      data-testid="terminal-elsewhere-note"
      className="min-w-0 truncate"
      onClick={() => window.dispatchEvent(new CustomEvent(TERMINAL_PICKER_EVENTS.drawer))}
    >
      {note}
    </Button>
  </div>
);
