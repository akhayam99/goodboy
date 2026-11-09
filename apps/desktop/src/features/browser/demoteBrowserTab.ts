import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';

type Params = {
  readonly sessionId: SessionId;
};

export const demoteBrowserTab = ({ sessionId }: Params): void => {
  const state = useAppStore.getState();
  state.navigate({
    to: lensPlace({ state, sessionId, lens: state.activeLens[sessionId] ?? null }),
    drawer: { kind: 'browser', sessionId, payload: null },
  });
};
