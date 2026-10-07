import type { ArtifactId, SessionId } from '@goodboy/types';
import { usePlanModel } from '../../../plans/usePlanModel';
import { PlanDrawerFrame } from './PlanDrawerFrame';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly revision: number | null;
  readonly onClose: () => void;
};

export const ArtifactDocumentDrawer = ({ sessionId, artifactId, revision, onClose }: Props) => {
  const model = usePlanModel({ sessionId, planId: artifactId });
  if (model === null) {
    return null;
  }
  return (
    <PlanDrawerFrame sessionId={sessionId} model={model} revision={revision} onClose={onClose} />
  );
};
