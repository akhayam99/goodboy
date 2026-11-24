import type { Agent, Step } from '@goodboy/types';

type Params = {
  readonly step: Step | null;
  readonly agent: Agent | null;
};

export const referenceStepOf = ({ step, agent }: Params): Step | null => {
  const decision = agent?.routingDecision ?? null;
  if (step === null || decision === null || step.routingLock != null) {
    return step;
  }
  return { ...step, routingDecision: decision };
};
