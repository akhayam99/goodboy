import { useEffect, useRef } from 'react';
import { registerShortcut } from '../../../../../shared/keyboard/dispatcher';

type Params = {
  readonly onReset: () => void;
};

const ASK_PANEL_SELECTOR = 'section[aria-label="Ask"]';

type FocusParams = Record<never, never>;

const isFocusInsideAsk = ({}: FocusParams): boolean => {
  const active = document.activeElement;
  return active instanceof Element && active.closest(ASK_PANEL_SELECTOR) !== null;
};

export const useAskResetShortcut = ({ onReset }: Params): void => {
  const resetRef = useRef(onReset);
  resetRef.current = onReset;

  useEffect(() => {
    return registerShortcut(
      'ask.reset',
      () => {
        if (!isFocusInsideAsk({})) {
          return false;
        }
        resetRef.current();
        return true;
      },
      { canDecline: true },
    );
  }, []);
};
