import type { SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../store';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';

type Params = Readonly<{
  sessionId: SessionId;
  lens: LensKind | null;
}>;

export const openLens = ({ sessionId, lens }: Params): void => {
  const state = useAppStore.getState();
  if (lens === 'scripts') {
    state.setScriptsLensScope({ scope: null });
  }
  state.navigate({ to: lensPlace({ state, sessionId, lens }) });
};
