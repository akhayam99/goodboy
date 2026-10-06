import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { attentionPlace } from '../../../../session/attentionPlace';
import { MODAL_SELECTOR, registerShortcut } from '../../../../../shared/keyboard/dispatcher';
import { isTerminalFocused } from '../../../../../shared/keyboard/isTerminalFocused';
import { nextNeedsYou } from '../nextNeedsYou';

export const useNextNeedsYouShortcut = (): void => {
  useEffect(
    () =>
      registerShortcut(
        'session.nextNeedsYou',
        () => {
          if (isTerminalFocused() || document.querySelector(MODAL_SELECTOR) !== null) {
            return false;
          }
          const store = useAppStore.getState();
          const target = nextNeedsYou({ state: store });
          if (target === null) {
            return true;
          }
          store.navigate({
            to: attentionPlace({
              state: store,
              sessionId: target.sessionId,
              reason: target.reason,
            }),
          });
          return true;
        },
        { canDecline: true },
      ),
    [],
  );
};
