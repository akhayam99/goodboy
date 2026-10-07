import type { ArtifactId, SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../store';
import { openPlanDrawer } from './openPlanDrawer';

type Params = Readonly<{
  sessionId: SessionId;
  planId: ArtifactId;
}>;

export const openPlanAnywhere = ({ sessionId, planId }: Params): void => {
  const state = useAppStore.getState();
  const isCurrent = state.currentSessionId === sessionId;
  if (isCurrent && state.activeLens[sessionId] === 'plans') {
    state.navigate({
      to: sessionPlace({
        sessionId,
        lens: 'plans',
        target: { kind: 'artifact', artifactId: planId },
      }),
    });
    return;
  }
  if (isCurrent) {
    openPlanDrawer({ sessionId, planId });
    return;
  }
  state.navigate({
    to: sessionPlace({ sessionId }),
    drawer: {
      kind: 'artifact-document',
      sessionId,
      payload: { artifactId: planId, revision: null },
    },
  });
};
