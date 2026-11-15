import { useAppStore } from '../../store';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';
import type { StartWorkSeed } from '../../store/slices/work/state';
import { dispatchAfterNavigation } from '../actions/dispatchAfterNavigation';
import { openNewSessionAs } from '../session/startKind/openNewSessionAs';
import { startRunEventName } from '../session/startRun/startRunEventName';

type Params = {
  readonly seed: StartWorkSeed;
};

export const openStartWork = ({ seed }: Params): void => {
  const { sessionId, text } = seed;
  if (sessionId === null) {
    openNewSessionAs({ startKind: 'auto' });
    return;
  }
  const state = useAppStore.getState();
  state.navigate({ to: lensPlace({ state, sessionId, lens: 'workflows' }) });
  dispatchAfterNavigation({ name: startRunEventName({ sessionId }), detail: { text } });
};
