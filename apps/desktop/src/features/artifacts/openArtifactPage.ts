import type { ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionPlace } from '../../store/slices/navigation/place';

type Params = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly isArrival?: boolean;
};

export const openArtifactPage = ({ sessionId, artifactId, isArrival = false }: Params): void => {
  const state = useAppStore.getState();
  const isOnList =
    state.currentSessionId === sessionId &&
    state.activeLens[sessionId] === 'plans' &&
    (state.focusedArtifactId[sessionId] ?? null) === null;
  if (isArrival && !isOnList) {
    return;
  }
  state.navigate({
    to: sessionPlace({ sessionId, lens: 'plans', target: { kind: 'artifact', artifactId } }),
    mode: isArrival ? 'replace' : 'push',
  });
};
