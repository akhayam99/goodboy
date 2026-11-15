import type { AutoDelegation } from '@goodboy/db';
import { delegationCardOf } from '../chat/delegationCardOf';

export type DelegationAttempts = Readonly<{
  attempts: number;
  lastNote: string | null;
}>;

type Params = {
  readonly agentId: string;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

type ChainParams = {
  readonly head: AutoDelegation;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

const priorAttemptsOf = ({ head, delegations }: ChainParams): ReadonlyArray<AutoDelegation> => {
  const prior: Array<AutoDelegation> = [];
  const seen = new Set<string>([head.id]);
  let next = head.retryOf;
  while (next !== null && !seen.has(next)) {
    const found = delegations.find((candidate) => candidate.id === next);
    if (found === undefined) {
      break;
    }
    seen.add(found.id);
    prior.push(found);
    next = found.retryOf;
  }
  return prior;
};

type NoteParams = {
  readonly delegation: AutoDelegation;
};

const resultNoteOf = ({ delegation }: NoteParams): string | null => {
  const { result } = delegationCardOf({ delegation, childAgent: null });
  if (result === null) {
    return null;
  }
  return result.outcomeLine?.text ?? result.summary ?? result.reasonText;
};

const ONE_ATTEMPT: DelegationAttempts = { attempts: 1, lastNote: null };

export const delegationAttemptsOf = ({ agentId, delegations }: Params): DelegationAttempts => {
  const head = delegations
    .filter((candidate) => candidate.childAgentId === agentId)
    .reduce<AutoDelegation | null>(
      (latest, candidate) =>
        latest === null || candidate.createdAt > latest.createdAt ? candidate : latest,
      null,
    );
  if (head === null) {
    return ONE_ATTEMPT;
  }
  const prior = priorAttemptsOf({ head, delegations });
  const last = prior[0];
  return {
    attempts: prior.length + 1,
    lastNote: last === undefined ? null : resultNoteOf({ delegation: last }),
  };
};
