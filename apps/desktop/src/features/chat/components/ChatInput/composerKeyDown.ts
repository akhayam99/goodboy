import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../shared/keyboard/registry';

type Params = {
  readonly popoverOpen: boolean;
  readonly onEscape?: () => boolean;
};

export const composerKeyDown =
  ({ popoverOpen, onEscape }: Params) =>
  (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (
      popoverOpen &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Tab')
    ) {
      event.preventDefault();
      return;
    }
    if (
      onEscape !== undefined &&
      !event.nativeEvent.isComposing &&
      eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['agent.stop'] }) &&
      onEscape()
    ) {
      event.preventDefault();
    }
  };
