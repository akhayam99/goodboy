import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { MODAL_SELECTOR, registerShortcut } from '../../../../../shared/keyboard/dispatcher';
import { isTerminalFocused } from '../../../../../shared/keyboard/isTerminalFocused';
import { goToNextNeedsYou } from '../goToNextNeedsYou';

export const useNextNeedsYouShortcut = (): void => {
  useEffect(
    () =>
      registerShortcut(
        'session.nextNeedsYou',
        () => {
          if (isTerminalFocused() || document.querySelector(MODAL_SELECTOR) !== null) {
            return false;
          }
          goToNextNeedsYou({ state: useAppStore.getState() });
          return true;
        },
        { canDecline: true },
      ),
    [],
  );
};
