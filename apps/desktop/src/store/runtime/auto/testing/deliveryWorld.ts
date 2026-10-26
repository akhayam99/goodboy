import { EMPTY_USER_FACTS } from '@goodboy/core';
import { insertAutoOutbox, type AutoOutboxKind } from '@goodboy/db';
import { brandId, type AutoOutboxId } from '@goodboy/types';
import type { AutoTurnEnded } from '../ports';
import type { AgentVerbContext } from '../verbContext';
import { AUTO_SEED_ROOT } from '@goodboy/db/test-helpers/auto-seeds';
import { makeAutoWorld, WORLD_TREE, type AutoWorld } from './autoWorld';
import { makeFakePorts, type FakePorts } from './fakePorts';

export type DeliveryWorld = Readonly<{
  world: AutoWorld;
  ports: FakePorts;
  ctx: AgentVerbContext;
  ended: Array<AutoTurnEnded>;
  onEnded: (ended: AutoTurnEnded) => void;
}>;

type DeliveryWorldParams = {
  readonly agentIds?: ReadonlyArray<string>;
  readonly planIds?: ReadonlyArray<Readonly<{ id: string; agentId: string }>>;
  readonly isDeciding?: boolean;
  readonly capUsd?: number;
};

export const makeDeliveryWorld = async ({
  agentIds,
  planIds,
  isDeciding = false,
  capUsd = 5,
}: DeliveryWorldParams = {}): Promise<DeliveryWorld> => {
  const world = await makeAutoWorld({
    isDeciding,
    capUsd,
    ...(agentIds === undefined ? {} : { agentIds }),
    ...(planIds === undefined ? {} : { planIds }),
  });
  const ports = makeFakePorts();
  const ended: Array<AutoTurnEnded> = [];
  return {
    world,
    ports,
    ended,
    onEnded: (event) => {
      ended.push(event);
    },
    ctx: { db: world.db, scheduler: world.scheduler, ports, now: world.clock.now },
  };
};

type RowParams = {
  readonly world: AutoWorld;
  readonly id: string;
  readonly kind: AutoOutboxKind;
  readonly payload: unknown;
  readonly generation?: number;
  readonly atMs?: number;
};

export const addOutboxRow = ({ world, id, kind, payload, generation = 1, atMs }: RowParams) =>
  insertAutoOutbox({
    db: world.db,
    outbox: {
      id: brandId<AutoOutboxId>({ value: id }),
      treeId: WORLD_TREE,
      generation,
      kind,
      joinKey: `${kind}:${id}`,
      payload,
      nowMs: atMs ?? world.clock.now(),
    },
  });

type UserRowParams = {
  readonly world: AutoWorld;
  readonly id: string;
  readonly text: string;
  readonly atMs?: number;
};

export const addUserRow = ({ world, id, text, atMs }: UserRowParams) =>
  addOutboxRow({
    world,
    id,
    kind: 'user',
    payload: { kind: 'user', text, facts: EMPTY_USER_FACTS },
    ...(atMs === undefined ? {} : { atMs }),
  });

type QuestionRowParams = {
  readonly world: AutoWorld;
  readonly id: string;
  readonly delegationId?: string;
};

export const addQuestionRow = ({ world, id, delegationId = 'delegation-a' }: QuestionRowParams) =>
  addOutboxRow({
    world,
    id,
    kind: 'question',
    payload: {
      kind: 'question',
      delegationId,
      attemptId: 'attempt-a',
      questionId: `question-${id}`,
      role: 'implementer',
      childAgentId: 'agent-a',
      text: 'Which mount?',
      suggestedAnswers: [],
      recommendedAnswer: null,
    },
  });

export const endedTurn = (overrides: Partial<AutoTurnEnded> = {}): AutoTurnEnded => ({
  treeId: WORLD_TREE,
  generation: 1,
  runId: 'id-1',
  deliveryId: 'outbox-user-1',
  agentId: AUTO_SEED_ROOT,
  assistantText: 'Here is the answer.',
  exit: 'ok',
  costUsd: 0.1,
  ...overrides,
});
