export type DelegationDecision = 'confirm' | 'decline';

type DelegationDecisionResult = 'confirmed' | 'declined' | 'lost';

type DecisionParams = {
  readonly delegationId: string;
  readonly decision: DelegationDecision;
};

export type DelegationDecisionPort = (params: DecisionParams) => Promise<DelegationDecisionResult>;

type Registry = {
  port: DelegationDecisionPort | null;
};

const registry: Registry = { port: null };

type RegisterParams = {
  readonly port: DelegationDecisionPort | null;
};

export const registerDelegationDecisionPort = ({ port }: RegisterParams): void => {
  registry.port = port;
};

export const currentDelegationDecisionPort = (): DelegationDecisionPort | null => registry.port;
