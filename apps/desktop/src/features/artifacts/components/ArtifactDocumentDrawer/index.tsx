import { DrawerFrame } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { GoneObject } from '../../../../shared/components/GoneObject';
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
    return (
      <DrawerFrame title="Artifact" icon={CONCEPT_ICONS.artifacts} onClose={onClose}>
        <GoneObject noun="artifact" icon={CONCEPT_ICONS.artifacts} />
      </DrawerFrame>
    );
  }
  return (
    <PlanDrawerFrame sessionId={sessionId} model={model} revision={revision} onClose={onClose} />
  );
};
