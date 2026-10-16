import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { requestAskFocus } from '../askFocusEvent';

type Params = {
  readonly sessionId: SessionId;
};

export const useAskOpenShortcut = ({ sessionId }: Params): void => {
  const isOpen = useAppStore((state) => {
    const drawer = selectOpenDrawer(state);
    return drawer?.kind === 'ask' && drawer.sessionId === sessionId;
  });
  const isCurrent = useAppStore(
    (state) => state.currentSessionId === sessionId && state.appStudio === null,
  );
  const openAsk = useAppStore((state) => state.openAsk);

  useShortcut(
    'ask.open',
    (event) => {
      event.preventDefault();
      if (!isOpen) {
        openAsk({ sessionId });
      }
      requestAskFocus();
    },
    isCurrent,
  );
};
