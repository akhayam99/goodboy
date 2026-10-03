import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { isSubmitChord } from '../../../../shared/keyboard/isSubmitChord';

type Params = {
  readonly popoverOpen: boolean;
  readonly isRunning: boolean;
  readonly onSend: () => Promise<void>;
  readonly onSendNow: () => Promise<void>;
};

export const composerKeyDown =
  ({ popoverOpen, isRunning, onSend, onSendNow }: Params) =>
  (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (
      popoverOpen &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Tab')
    ) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !popoverOpen) {
      event.preventDefault();
      void (isRunning && isSubmitChord(event) ? onSendNow() : onSend());
    }
  };
