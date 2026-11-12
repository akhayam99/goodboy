import type { ArtifactId, SessionId } from '@goodboy/types';
import { AutoPlanToolbar } from '../plan/AutoPlanToolbar';
import { useAutoPlanApproval } from '../plan/useAutoPlanApproval';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const AutoPlanToolbarFromStore = ({ sessionId, artifactId }: Props) => {
  const model = useAutoPlanApproval({ sessionId, artifactId });
  return model === null ? null : <AutoPlanToolbar model={model} />;
};
