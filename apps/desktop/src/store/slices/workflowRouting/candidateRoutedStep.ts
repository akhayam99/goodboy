import { buildCandidates, stepSizeOf, type CandidateInputs } from '@goodboy/core/providers';
import type { AgentRole, ProviderId, Step } from '@goodboy/types';
import { candidateDecision } from './candidateDecision';
import { writerFamilyOf, type RoutedPick } from './writerFamilyOf';

type Params = {
  readonly step: Step;
  readonly role: AgentRole;
  readonly inputs: CandidateInputs | null;
  readonly earlier: ReadonlyArray<RoutedPick>;
  readonly batch: ReadonlyArray<ProviderId>;
};

const isUnrouted = ({ step }: Pick<Params, 'step'>): boolean =>
  step.routingLock == null &&
  step.routingDecision == null &&
  step.providerOverride == null &&
  step.modelOverride == null &&
  step.effort == null;

export const candidateRoutedStep = ({ step, role, inputs, earlier, batch }: Params): Step => {
  if (inputs === null || !isUnrouted({ step })) {
    return step;
  }
  const list = buildCandidates({
    inputs,
    need: {
      role,
      size: step.size ?? stepSizeOf({ difficulty: step.taskProfile?.difficulty }),
      scope: 'step',
      writerFamily: writerFamilyOf({ role, earlier }),
    },
  });
  const routed = candidateDecision({ list, proposal: null, batch });
  return routed.kind === 'ready' ? { ...step, routingDecision: routed.decision } : step;
};
