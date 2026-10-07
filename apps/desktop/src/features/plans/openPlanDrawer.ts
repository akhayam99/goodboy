import type { ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

type Params = Readonly<{
  sessionId: SessionId;
  planId: ArtifactId;
}>;

export const openPlanDrawer = ({ sessionId, planId }: Params): void => {
  useAppStore.getState().openDrawer({
    kind: 'artifact-document',
    sessionId,
    payload: { artifactId: planId, revision: null },
  });
};
