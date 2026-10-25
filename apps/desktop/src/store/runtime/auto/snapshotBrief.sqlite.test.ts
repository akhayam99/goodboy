import { describe, expect, it } from 'vitest';
import { listAutoDelegations, saveSessionDecisions } from '@goodboy/db';
import { brandId, type IsoDateTime, type SessionDecision } from '@goodboy/types';
import { WORLD_GRANT } from './testing/fakePorts';
import {
  autoCommand,
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const NOW = brandId<IsoDateTime>({ value: '2026-10-19T09:00:00.000Z' });

const decisionRow = (
  fields: Pick<SessionDecision, 'number' | 'text' | 'status' | 'replacedBy'>,
): SessionDecision => ({
  id: `decision-${fields.number}`,
  sessionId: WORLD_GRANT.sessionId,
  why: null,
  author: 'user',
  agentId: null,
  turnOrdinal: null,
  reason: null,
  closedBy: null,
  closedByAgentId: null,
  previousText: null,
  rewordedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...fields,
});

const IMPLEMENTER = {
  role: 'implementer',
  task: 'move the rounding into settle_batch',
  reason: 'a code change',
  mount: 'mount-ledger-core',
  decisions: ['D27', 'D3', 'D99'],
};

const world = async (): Promise<RuntimeWorld> => {
  const made = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world: made, id: 'outbox-user-1', text: 'round once per batch' });
  await saveSessionDecisions({
    db: made.state.world.db,
    decisions: [
      decisionRow({
        number: 27,
        text: 'Round once per batch in settle_batch.',
        status: 'active',
        replacedBy: null,
      }),
      decisionRow({
        number: 3,
        text: 'Round each posting.',
        status: 'replaced',
        replacedBy: 27,
      }),
    ],
  });
  return made;
};

const delegationsOf = (made: RuntimeWorld) =>
  listAutoDelegations({ db: made.state.world.db, treeId: made.treeId });

const failFirstChild = async (made: RuntimeWorld): Promise<void> => {
  await autoTurnEnds({ world: made });
  await childTurnEnds({ world: made, index: 0, text: 'I could not finish this.' });
};

const retryOf = async (made: RuntimeWorld, id: string | undefined) =>
  autoCommand({
    world: made,
    verb: 'delegate',
    args: {
      'request-id': 'request-retry',
      spec: JSON.stringify({ children: [{ retryOf: id, reason: 'again' }] }),
    },
  });

describe('the snapshot brief of an Auto child', () => {
  it('writes each named decision in full and says what became of the others', async () => {
    const made = await world();
    const outcome = await autoDelegates({ world: made, spec: { children: [IMPLEMENTER] } });
    expect(outcome).toMatchObject({ isOk: true });
    const [row] = await delegationsOf(made);
    const kickoff = String(row?.request['kickoff']);
    expect(kickoff).toContain('- D27 Round once per batch in settle_batch.');
    expect(kickoff).toContain('- D3 was replaced by D27');
    expect(kickoff).toContain('- D99 is not a decision of this conversation');
    expect(kickoff.indexOf('**Decisions**')).toBeLessThan(kickoff.indexOf('**Task**'));
    expect(row?.request['decisions']).toEqual(['D27', 'D3', 'D99']);
  });

  it('refuses nothing for an id that does not exist and still starts the child', async () => {
    const made = await world();
    const outcome = await autoDelegates({
      world: made,
      spec: { children: [{ ...IMPLEMENTER, decisions: ['D404'] }] },
    });
    expect(outcome).toMatchObject({ isOk: true });
    expect(await delegationsOf(made)).toHaveLength(1);
  });

  it('does not expand an id written in the task text', async () => {
    const made = await world();
    await autoDelegates({
      world: made,
      spec: {
        children: [{ ...IMPLEMENTER, task: 'follow D27 when you move it', decisions: undefined }],
      },
    });
    const [row] = await delegationsOf(made);
    const kickoff = String(row?.request['kickoff']);
    expect(kickoff).not.toContain('**Decisions**');
    expect(kickoff).not.toContain('Round once per batch');
  });

  it('stamps version 2 on a new delegation and hands it to the child turn', async () => {
    const made = await world();
    await autoDelegates({ world: made, spec: { children: [IMPLEMENTER] } });
    await autoTurnEnds({ world: made });
    const [row] = await delegationsOf(made);
    expect(row?.request['briefVersion']).toBe(2);
    expect(made.state.ports.childTurns[0]?.briefVersion).toBe(2);
  });

  it('keeps version 2 and reads the decisions again when a child is retried', async () => {
    const made = await world();
    await autoDelegates({ world: made, spec: { children: [IMPLEMENTER] } });
    await failFirstChild(made);
    const [original] = await delegationsOf(made);
    const outcome = await retryOf(made, original?.id);
    expect(outcome).toMatchObject({ isOk: true });
    const retried = (await delegationsOf(made)).find((row) => row.retryOf !== null);
    expect(retried?.request['briefVersion']).toBe(2);
    expect(retried?.request['decisions']).toEqual(['D27', 'D3', 'D99']);
    expect(String(retried?.request['kickoff'])).toContain('- D27 Round once per batch');
  });

  it('keeps version 1 for a retry of a delegation made before the upgrade', async () => {
    const made = await world();
    await autoDelegates({ world: made, spec: { children: [{ ...IMPLEMENTER, decisions: [] }] } });
    await made.state.world.db.execute(
      "UPDATE auto_delegations SET request_json = json_remove(request_json, '$.briefVersion')",
      [],
    );
    await failFirstChild(made);
    const [original] = await delegationsOf(made);
    expect(original?.request['briefVersion']).toBeUndefined();
    await retryOf(made, original?.id);
    const retried = (await delegationsOf(made)).find((row) => row.retryOf !== null);
    expect(retried).toBeDefined();
    expect(retried?.request['briefVersion']).toBeUndefined();
    await autoTurnEnds({ world: made });
    expect(made.state.ports.childTurns.at(-1)?.briefVersion).toBeUndefined();
  });

  it('refuses decisions on a retry and starts nothing', async () => {
    const made = await world();
    await autoDelegates({ world: made, spec: { children: [IMPLEMENTER] } });
    await failFirstChild(made);
    const [original] = await delegationsOf(made);
    const outcome = await autoCommand({
      world: made,
      verb: 'delegate',
      args: {
        'request-id': 'request-retry',
        spec: JSON.stringify({
          children: [{ retryOf: original?.id, reason: 'again', decisions: ['D27'] }],
        }),
      },
    });
    expect(outcome).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(await delegationsOf(made)).toHaveLength(1);
  });
});
