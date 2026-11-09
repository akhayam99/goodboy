import { vi } from 'vitest';
import { publishOfResult, type MountSnapshot, type ResultPublish } from '@goodboy/core/auto';
import { listAutoAttemptsOfDelegation, listAutoDelegations } from '@goodboy/db';
import type { AutoDelegationId } from '@goodboy/types';
import type { AutoCheckScript } from '../ports';
import { makeGate } from './makeGate';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './runtimeWorld';

export const LEDGER_PATH = '/work/harborline/ledger-core';
export const NOTIFY_PATH = '/work/harborline/notify-relay';

export const START: MountSnapshot = { head: 'base000', entries: [], isPartial: false };
export const END: MountSnapshot = { head: 'abc123', entries: [], isPartial: false };

export type PublishSpec = string | Readonly<Record<string, unknown>>;

type ImplementerParams = {
  readonly publish: PublishSpec;
  readonly mount: string;
};

export const implementer = ({ publish, mount }: ImplementerParams) => ({
  role: 'implementer',
  task: `rewrite the history of ${mount}`,
  reason: 'a code change',
  mount,
  publish,
});

export type SettleParams = {
  readonly publishes: ReadonlyArray<Readonly<{ publish: PublishSpec; mount: string }>>;
  readonly checks?: ReadonlyArray<AutoCheckScript>;
  readonly configure?: (world: RuntimeWorld) => void;
};

export const settle = async ({
  publishes,
  checks = [],
  configure,
}: SettleParams): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'tidy the history and push it' });
  world.state.ports.setChecks(checks);
  world.state.ports.setSnapshots(LEDGER_PATH, [START, END]);
  world.state.ports.setSnapshots(NOTIFY_PATH, [START, END]);
  configure?.(world);
  const outcome = await autoDelegates({
    world,
    spec: { children: publishes.map((one) => implementer(one)) },
  });
  if (!outcome.isOk) {
    throw new Error(`the delegate was refused: ${outcome.error ?? ''}`);
  }
  await autoTurnEnds({ world });
  for (const [index, turn] of world.state.ports.childTurns.entries()) {
    await childTurnEnds({
      world,
      index,
      text: `Done.\n<<step-done id="${turn.childAgentId}">>`,
    });
  }
  return world;
};

export const delegationsOf = async (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

export const recordOf = async (world: RuntimeWorld, index = 0): Promise<ResultPublish> => {
  const delegation = (await delegationsOf(world))[index];
  const record = publishOfResult({ result: delegation?.result });
  if (record === null) {
    throw new Error('a publish record was expected');
  }
  return record;
};

export const idsOf = async (world: RuntimeWorld): Promise<ReadonlyArray<AutoDelegationId>> =>
  (await delegationsOf(world)).map((delegation) => delegation.id);

export const attemptPublishOf = async (world: RuntimeWorld): Promise<unknown> => {
  const [delegation] = await delegationsOf(world);
  if (delegation === undefined) {
    return null;
  }
  const attempts = await listAutoAttemptsOfDelegation({
    db: world.state.world.db,
    delegationId: delegation.id,
  });
  const snapshot = attempts.at(-1)?.resultSnapshot;
  return typeof snapshot === 'object' && snapshot !== null && 'envelope' in snapshot
    ? publishOfResult({ result: snapshot.envelope })
    : null;
};

export const LEDGER_PUSH = { publish: 'push', mount: 'mount-ledger-core' };
export const LEDGER_FORCE = { publish: 'force', mount: 'mount-ledger-core' };

type HoldParams = {
  readonly world: RuntimeWorld;
};

export const holdPushes = ({ world }: HoldParams) => {
  const held = makeGate();
  const original = world.state.ports.pushBranch;
  vi.spyOn(world.state.ports, 'pushBranch').mockImplementation(async (params) => {
    await held.promise;
    return original(params);
  });
  return held;
};

type LeavePushingParams = {
  readonly world: RuntimeWorld;
  readonly startedAt?: number;
};

export const leavePushing = async ({ world, startedAt }: LeavePushingParams): Promise<void> => {
  const started = startedAt === undefined ? null : startedAt;
  await world.state.world.db.execute(
    `UPDATE auto_delegations SET result_json = json_set(result_json,
      '$.verified.publish.state', 'pushing',
      '$.verified.publish.isConfirmed', json('true'),
      '$.verified.publish.isRetryable', json('false'),
      '$.verified.publish.startedAt', ?,
      '$.verified.publish.message', NULL)`,
    [started],
  );
  await world.state.world.db.execute(
    `UPDATE auto_attempts SET result_snapshot_json = json_set(result_snapshot_json,
      '$.envelope.verified.publish.state', 'pushing',
      '$.envelope.verified.publish.isConfirmed', json('true'),
      '$.envelope.verified.publish.isRetryable', json('false'),
      '$.envelope.verified.publish.startedAt', ?,
      '$.envelope.verified.publish.message', NULL)`,
    [started],
  );
};
