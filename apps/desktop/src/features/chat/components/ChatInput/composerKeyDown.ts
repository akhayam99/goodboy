import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

type Params = {
  readonly popoverOpen: boolean;
};

export const composerKeyDown =
  ({ popoverOpen }: Params) =>
  (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (
      popoverOpen &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Tab')
    ) {
      event.preventDefault();
    }
  };
