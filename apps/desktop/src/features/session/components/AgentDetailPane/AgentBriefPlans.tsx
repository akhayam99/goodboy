import { Band } from '@goodboy/ui';
import type { PlanWithCount, SessionId } from '@goodboy/types';
import { PlanRow } from '../../../plans/planSurfaces';

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly sessionId: SessionId;
};

export const AgentBriefPlans = ({ plans, sessionId }: Props) => {
  if (plans.length === 0) {
    return null;
  }
  return (
    <Band inset="content" label="Plans">
      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <PlanRow key={plan.id} sessionId={sessionId} planId={plan.id} />
        ))}
      </div>
    </Band>
  );
};
