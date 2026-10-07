import type { ArtifactId, SessionId } from '@goodboy/types';
import { usePlanModel } from '../../usePlanModel';
import { PlanRowBody } from './PlanRowBody';

type Props = {
  readonly sessionId: SessionId;
  readonly planId: ArtifactId;
};

export const PlanRow = ({ sessionId, planId }: Props) => {
  const model = usePlanModel({ sessionId, planId });
  if (model === null) {
    return null;
  }
  return <PlanRowBody sessionId={sessionId} model={model} />;
};
