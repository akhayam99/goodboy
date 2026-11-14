import { describe, expect, it, vi } from 'vitest';
import {
  getAutoGrant,
  insertAutoAttemptStatement,
  insertAutoGrantStatement,
  listAutoDelegations,
  listAutoGrantAllowances,
  markAutoGrantUsedStatement,
  type AutoGrantId,
} from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AutoAttemptId } from '@goodboy/types';
import type {
  AutoBridgeBus,
  AutoBridgePorts,
} from '../../../../features/auto/bridge/autoBridgeProtocol';
import { createAutoBridgeClient } from '../../../../features/auto/bridge/createAutoBridgeClient';
import { serveAutoBridge } from '../../../../features/auto/bridge/serveAutoBridge';
import { readAutoTreeViews } from '../../../slices/auto-view/readAutoTreeViews';
import { writeAutoLevel } from '../level/writeAutoLevel';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';
import { createAskAnswerer } from './createAskAnswerer';
import { leadAsksOf } from './leadAsksOf';

const target = { sessionId: AUTO_SEED_SESSION };
const tester = { role: 'scout', task: 'cover the payments-api retries', reason: 'find the gaps' };
const NEED = 'I need nock 14.0.1 to stub the host.';

type WorldParams = {
  readonly level?: 'run' | 'step';
};

const testerWorld = async ({ level = 'run' }: WorldParams = {}): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await writeAutoLevel({ db: world.state.world.db, target, level });
  await userSays({ world, id: 'outbox-acme', text: 'cover the payments-api retries' });
  await autoDelegates({ world, spec: [tester] });
  await autoTurnEnds({ world });
  return world;
};

type AskParams = {
  readonly world: RuntimeWorld;
  readonly id: string;
  readonly subject?: string;
};

const testerAsks = async ({ world, id, subject = 'nock@14.0.1' }: AskParams) => {
  const turn = world.state.ports.childTurns[0];
  if (turn === undefined) {
    throw new Error('Expected the tester to run');
  }
  const grantId = brandId<AutoGrantId>({ value: id });
  await world.state.world.db.transaction({
    statements: [
      insertAutoGrantStatement({
        grant: {
          id: grantId,
          treeId: world.treeId,
          delegationId: turn.delegationId,
          attemptId: turn.attemptId,
          textVersion: null,
          kind: 'dependency',
          subject,
          nowMs: world.state.world.clock.now(),
        },
      }),
    ],
  });
  return { grantId, askId: `grant:${grantId}`, turn };
};

type ViewParams = {
  readonly world: RuntimeWorld;
};

const asksNow = async ({ world }: ViewParams) => {
  const views = await readAutoTreeViews({ db: world.state.world.db, sessionId: AUTO_SEED_SESSION });
  return views.flatMap((view) => leadAsksOf({ view }));
};

const answererOf = ({ world }: ViewParams) => createAskAnswerer({ runtimeOf: () => world.runtime });

type Handler = (payload: unknown) => void;

const memoryBus = (): AutoBridgeBus => {
  const handlers = new Map<string, Set<Handler>>();
  return {
    emit: async ({ event, payload }) => {
      for (const handler of handlers.get(event) ?? []) {
        handler(JSON.parse(JSON.stringify(payload)));
      }
    },
    listen: async ({ event, onPayload }) => {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(onPayload);
      handlers.set(event, set);
      return () => {
        set.delete(onPayload);
      };
    },
  };
};

type LaunchParams = {
  readonly id: string;
};

const unused = async (): Promise<never> => {
  throw new Error('not part of this test');
};

describe('Lead asks as rows', () => {
  it('answers an ask twice and settles it once', async () => {
    const world = await testerWorld();
    await childTurnEnds({ world, index: 0, text: NEED });
    const { askId, grantId } = await testerAsks({ world, id: 'grant-nock' });
    const answer = answererOf({ world });

    expect(
      await Promise.all([answer({ askId, answer: 'allow' }), answer({ askId, answer: 'decline' })]),
    ).toEqual(['allowed', 'settled']);
    expect(await answer({ askId, answer: 'allow' })).toBe('settled');
    expect(await getAutoGrant({ db: world.state.world.db, grantId })).toMatchObject({
      state: 'allowed',
    });
    expect(await asksNow({ world })).toEqual([]);
    expect(world.errors).toEqual([]);
  });

  it('takes an answer from the other window, and the ask leaves both', async () => {
    const world = await testerWorld();
    await childTurnEnds({ world, index: 0, text: NEED });
    const { askId } = await testerAsks({ world, id: 'grant-nock' });
    expect((await asksNow({ world })).map((ask) => [ask.id, ask.kind, ask.subject])).toEqual([
      [askId, 'dependency', 'nock@14.0.1'],
    ]);
    const bus = memoryBus();
    const ports: AutoBridgePorts = {
      stop: unused,
      retry: unused,
      sendNow: unused,
      withdraw: unused,
      rerunChecks: unused,
      publish: unused,
      userTurn: unused,
      childTurn: unused,
      decision: unused,
      answerAsk: answererOf({ world }),
    };
    const unserve = await serveAutoBridge({ bus, ports, onError: vi.fn() });
    const other = await createAutoBridgeClient({ bus, newId: () => crypto.randomUUID() });

    expect(await other.ports.answerAsk({ askId, answer: 'allow' })).toBe('allowed');
    expect(await other.ports.answerAsk({ askId, answer: 'allow' })).toBe('settled');
    expect(await asksNow({ world })).toEqual([]);
    expect(await asksNow({ world: restartedWorld({ world, isLeaseLapsed: false }) })).toEqual([]);
    other.close();
    unserve();
  });

  it('drops an answer for an attempt a newer attempt replaced', async () => {
    const world = await testerWorld();
    await childTurnEnds({ world, index: 0, text: NEED });
    const { askId, grantId, turn } = await testerAsks({ world, id: 'grant-nock' });
    await world.state.world.db.transaction({
      statements: [
        insertAutoAttemptStatement({
          id: brandId<AutoAttemptId>({ value: 'attempt-tester-again' }),
          delegationId: turn.delegationId,
          treeId: world.treeId,
          generation: turn.generation,
          baseline: null,
          writeSet: null,
          nowMs: world.state.world.clock.now(),
        }),
      ],
    });

    expect(await asksNow({ world })).toEqual([]);
    expect(await answererOf({ world })({ askId, answer: 'allow' })).toBe('settled');
    expect(await getAutoGrant({ db: world.state.world.db, grantId })).toMatchObject({
      state: 'asked',
    });
  });

  it('drops a push answer for an older commit and lists the newer one', async () => {
    const world = await testerWorld();
    await childTurnEnds({ world, index: 0, text: 'Covered the retries.' });
    const db = world.state.world.db;
    const delegation = (await listAutoDelegations({ db, treeId: world.treeId }))[0];
    if (delegation === undefined) {
      throw new Error('Expected the tester delegation');
    }
    await db.execute(
      `UPDATE auto_delegations SET state = 'settled',
        result_json = json_set(COALESCE(result_json, '{}'), '$.verified', json(?)) WHERE id = ?`,
      [
        JSON.stringify({
          publish: {
            mode: 'force',
            state: 'awaiting_confirm',
            branch: 'ak/retries',
            sha: 'sha-new',
          },
        }),
        delegation.id,
      ],
    );
    const publish = vi.fn(world.runtime.publish);
    const answer = createAskAnswerer({ runtimeOf: () => ({ ...world.runtime, publish }) });

    expect((await asksNow({ world })).map((ask) => [ask.id, ask.kind, ask.subject])).toEqual([
      [`push:${delegation.id}:sha-new`, 'push', 'ak/retries'],
    ]);
    expect(await answer({ askId: `push:${delegation.id}:sha-old`, answer: 'allow' })).toBe(
      'settled',
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it('relaunches with the allowance after a crash between Allow and the start, once', async () => {
    const world = await testerWorld();
    await childTurnEnds({ world, index: 0, text: NEED });
    const { askId, grantId, turn } = await testerAsks({ world, id: 'grant-nock' });
    expect(await answererOf({ world })({ askId, answer: 'allow' })).toBe('allowed');
    const restarted = restartedWorld({ world });
    const db = restarted.state.ctx.db;
    const allowances = await listAutoGrantAllowances({ db, delegationId: turn.delegationId });
    expect(allowances.map((grant) => [grant.id, grant.subject])).toEqual([
      [grantId, 'nock@14.0.1'],
    ]);
    const launch = ({ id }: LaunchParams) =>
      db.transaction({
        statements: [
          ...allowances.map((grant) =>
            markAutoGrantUsedStatement({
              grantId: grant.id,
              nowMs: restarted.state.ctx.now(),
              abortCode: 'taken',
            }),
          ),
          insertAutoAttemptStatement({
            id: brandId<AutoAttemptId>({ value: id }),
            delegationId: turn.delegationId,
            treeId: world.treeId,
            generation: turn.generation,
            baseline: null,
            writeSet: null,
            nowMs: restarted.state.ctx.now(),
          }),
        ],
      });

    expect((await launch({ id: 'attempt-with-nock' })).status).toBe('committed');
    expect((await launch({ id: 'attempt-with-nock-twice' })).status).toBe('aborted');
    expect(await listAutoGrantAllowances({ db, delegationId: turn.delegationId })).toEqual([]);
    expect(await getAutoGrant({ db, grantId })).toMatchObject({ state: 'used' });
  });

  it('counts an ask by its id, however many times the agent names it', async () => {
    const world = await testerWorld();
    await childTurnEnds({ world, index: 0, text: NEED });
    await testerAsks({ world, id: 'grant-nock' });
    await testerAsks({ world, id: 'grant-nock-again' });
    await testerAsks({ world, id: 'grant-ci', subject: '.github/workflows/ci.yml' });

    const ids = (await asksNow({ world })).map((ask) => ask.id);
    expect(ids).toEqual(['grant:grant-nock', 'grant:grant-ci']);
  });

  it('still lists and answers a start that waits for your confirmation', async () => {
    const world = await testerWorld({ level: 'step' });
    const db = world.state.world.db;
    const asks = await asksNow({ world });
    const delegation = (await listAutoDelegations({ db, treeId: world.treeId }))[0];
    expect(asks.map((ask) => [ask.id, ask.kind])).toEqual([[`start:${delegation?.id}`, 'start']]);
    const answer = answererOf({ world });
    const askId = asks[0]?.id ?? '';

    expect(await answer({ askId, answer: 'allow' })).toBe('allowed');
    expect(await answer({ askId, answer: 'allow' })).toBe('settled');
    expect(await asksNow({ world })).toEqual([]);
  });
});
