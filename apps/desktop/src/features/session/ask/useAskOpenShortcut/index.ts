import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';

type Params = {
  readonly sessionId: SessionId;
};

export const useAskOpenShortcut = ({ sessionId }: Params): void => {
  const isCurrent = useAppStore(
    (state) => state.currentSessionId === sessionId && state.appStudio === null,
  );
  const openAsk = useAppStore((state) => state.openAsk);

  useShortcut(
    'ask.open',
    (event) => {
      event.preventDefault();
      openAsk({ sessionId });
    },
    isCurrent,
  );
};
