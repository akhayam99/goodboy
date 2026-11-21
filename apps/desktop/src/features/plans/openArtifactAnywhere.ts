import type { ArtifactId, SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../store';
import { openPlanDrawer } from './openPlanDrawer';

type Params = Readonly<{
  sessionId: SessionId;
  artifactId: ArtifactId;
}>;

export type ArtifactOpening = 'panel' | 'page';

export const openArtifactAnywhere = ({ sessionId, artifactId }: Params): ArtifactOpening => {
  const state = useAppStore.getState();
  const isCurrent = state.currentSessionId === sessionId;
  const isOnArtifacts = isCurrent && state.activeLens[sessionId] === 'plans';
  if (isCurrent && !isOnArtifacts) {
    openPlanDrawer({ sessionId, planId: artifactId });
    return 'panel';
  }
  state.navigate({
    to: sessionPlace({
      sessionId,
      lens: 'plans',
      target: { kind: 'artifact', artifactId },
    }),
  });
  return 'page';
};
