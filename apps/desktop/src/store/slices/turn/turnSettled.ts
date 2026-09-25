import type { AgentId } from '@goodboy/types';

type Params = Readonly<{
  agentId: AgentId;
}>;

type ActiveTurn = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  count: number;
};

const active = new Map<AgentId, ActiveTurn>();

export const markTurnActive = ({ agentId }: Params): void => {
  const existing = active.get(agentId);
  if (existing !== undefined) {
    existing.count += 1;
    return;
  }
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  active.set(agentId, { promise, resolve, count: 1 });
};

export const markTurnSettled = ({ agentId }: Params): void => {
  const existing = active.get(agentId);
  if (existing === undefined) {
    return;
  }
  existing.count -= 1;
  if (existing.count > 0) {
    return;
  }
  active.delete(agentId);
  existing.resolve();
};

export const waitTurnSettled = ({ agentId }: Params): Promise<void> =>
  active.get(agentId)?.promise ?? Promise.resolve();
