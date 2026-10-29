import type { PushFixOutcome } from '../types';

type Claims = Readonly<Record<PushFixOutcome['mountId'], PushFixOutcome['agentId']>>;

type Params = {
  readonly claims: Claims;
  readonly mountId: PushFixOutcome['mountId'];
  readonly agentId: PushFixOutcome['agentId'];
};

export const claimsWithout = ({ claims, mountId, agentId }: Params): Claims =>
  Object.fromEntries(
    Object.entries(claims).filter(([key, held]) => key !== mountId || held !== agentId),
  );
