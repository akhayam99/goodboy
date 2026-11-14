import { createPort } from './createPort';

export type DelegationDecision = 'confirm' | 'decline';

export type DelegationDecisionResult = 'confirmed' | 'declined' | 'lost' | 'refused';

type DecisionParams = {
  readonly delegationId: string;
  readonly decision: DelegationDecision;
  readonly hint?: string;
};

export type DelegationDecisionPort = (params: DecisionParams) => Promise<DelegationDecisionResult>;

const slot = createPort<DelegationDecisionPort>();

export const registerDelegationDecisionPort = slot.register;

export const currentDelegationDecisionPort = slot.current;
