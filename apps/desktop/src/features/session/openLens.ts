import type { SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore, type LensKind } from '../../store';

type Params = Readonly<{
  sessionId: SessionId;
  lens: LensKind | null;
}>;

export const openLens = ({ sessionId, lens }: Params): void => {
  const state = useAppStore.getState();
  if (lens === 'scripts') {
    state.setScriptsLensScope({ scope: null });
  }
  state.navigate({ to: sessionPlace({ sessionId, lens }) });
};
