import type { AutoDelegation } from '@goodboy/db';
import { delegationCardOf, type DelegationCardModel } from '../chat/delegationCardOf';
import type { LaunchSnapshotItem } from '../chat/launchSnapshotOf';

export const SPAWN_RECORD_NOT_RECORDED = 'Not recorded';
export const SPAWN_RECORD_STILL_WORKING = 'Still working.';
export const SPAWN_RECORD_NOTHING_GIVEN = 'Nothing was given to the agent.';

export type SpawnRecordRole = Readonly<{
  label: string;
  whyNot: string | null;
  reason: string | null;
}>;

export type SpawnRecordModel = Readonly<{
  agentId: string;
  title: string;
  why: string | null;
  brief: string | null;
  role: SpawnRecordRole;
  model: string | null;
  modelReason: string | null;
  wentIn: ReadonlyArray<LaunchSnapshotItem> | null;
  doneWhen: string | null;
  result: string | null;
  isLive: boolean;
  attempts: number;
  attemptsNote: string | null;
}>;

type Params = {
  readonly agentId: string;
  readonly number: string | null;
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

type ModelParams = {
  readonly card: DelegationCardModel;
};

const modelTextOf = ({ card }: ModelParams): string | null => {
  if (card.modelLine === null) {
    return null;
  }
  return card.modelLine.effort === null
    ? card.modelLine.name
    : `${card.modelLine.name} · ${card.modelLine.effort}`;
};

const resultTextOf = ({ card }: ModelParams): string | null => {
  if (card.result === null) {
    return null;
  }
  return card.result.outcomeLine?.text ?? card.result.summary ?? card.result.reasonText;
};

export const spawnRecordOf = ({
  agentId,
  number,
  delegations,
}: Params): SpawnRecordModel | null => {
  const owned = delegations
    .filter((candidate) => candidate.childAgentId === agentId)
    .sort((left, right) => right.createdAt - left.createdAt);
  const head = owned[0];
  if (head === undefined) {
    return null;
  }
  const card = delegationCardOf({ delegation: head, childAgent: null });
  const prior = priorAttemptsOf({ head, delegations });
  const lastPrior = prior[0];
  const attemptsNote =
    lastPrior === undefined
      ? null
      : resultTextOf({ card: delegationCardOf({ delegation: lastPrior, childAgent: null }) });
  return {
    agentId,
    title: number === null ? card.roleLabel : `${number} · ${card.roleLabel}`,
    why: card.reason,
    brief: card.task,
    role: {
      label: card.roleLabel,
      whyNot: card.roleKept === null ? null : card.roleKept.fitLabel,
      reason: card.roleReason,
    },
    model: modelTextOf({ card }),
    modelReason: card.modelReason,
    wentIn: card.wentIn,
    doneWhen: card.doneWhen,
    result: resultTextOf({ card }),
    isLive: card.isOpen,
    attempts: prior.length + 1,
    attemptsNote,
  };
};
