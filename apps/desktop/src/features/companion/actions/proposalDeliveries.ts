export type ProposalDelivery = {
  readonly sessionId: string;
  readonly agentId: string;
  readonly choice: string;
  readonly content: string;
};

type KeyParams = {
  readonly delegationId: string;
};

type RememberParams = KeyParams & {
  readonly delivery: ProposalDelivery;
};

const pending = new Map<string, ProposalDelivery>();

export const rememberProposalDelivery = ({ delegationId, delivery }: RememberParams): void => {
  pending.set(delegationId, delivery);
};

export const pendingProposalDeliveryOf = ({ delegationId }: KeyParams): ProposalDelivery | null =>
  pending.get(delegationId) ?? null;

export const forgetProposalDelivery = ({ delegationId }: KeyParams): void => {
  pending.delete(delegationId);
};
