// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AUTO_COMMAND_ROLES } from '@goodboy/core/auto';
import { listAutoDelegations } from '@goodboy/db';
import {
  autoTurnEndsWithBlock,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const startLead = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'check the ledger export' });
  return world;
};

const delegateBlock = (children: ReadonlyArray<Readonly<Record<string, unknown>>>) => ({
  action: 'delegate',
  requestId: 'request-1',
  children,
});

const delegationsOf = (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

describe('a task that needs a shell on a role without one', () => {
  it.each([
    ['task', { task: 'Run pnpm test on ledger-core.' }],
    ['done when', { task: 'Review the export.', doneWhen: 'Confirm the tests pass.' }],
    ['expected output', { task: 'Review the export.', expected: 'The output of git log.' }],
  ])('is refused before any helper starts when the %s asks for a command', async (_, fields) => {
    const world = await startLead();

    await autoTurnEndsWithBlock({
      world,
      block: delegateBlock([{ role: 'reviewer', reason: 'a review', ...fields }]),
    });

    expect(await delegationsOf(world)).toEqual([]);
    expect(world.state.ports.ensuredChildren).toEqual([]);
    expect(world.state.ports.childTurns).toEqual([]);
    expect(world.errors).toEqual([]);
  });

  it('answers the Lead with its next message, naming the reason and the roles that can', async () => {
    const world = await startLead();

    await autoTurnEndsWithBlock({
      world,
      block: delegateBlock([
        { role: 'scout', task: 'Run git log on ledger-core.', reason: 'a search' },
      ]),
    });

    const told = world.state.ports.autoTurns[1]?.text ?? '';
    expect(world.state.ports.autoTurns).toHaveLength(2);
    expect(told).toContain('REFUSED, NOT DONE');
    expect(told).toContain('scout has no shell');
    expect(told).toContain(`a role that can: ${AUTO_COMMAND_ROLES.join(', ')}`);
    expect(world.state.ports.childTurns).toEqual([]);
  });

  it('starts a reading helper whose task says make sure', async () => {
    const world = await startLead();

    await autoTurnEndsWithBlock({
      world,
      block: delegateBlock([
        {
          role: 'scout',
          task: 'Find the export callers and make sure the list covers notify-relay.',
          reason: 'a search',
        },
      ]),
    });
    const turn = world.state.ports.childTurns[0];
    await childTurnEnds({
      world,
      index: 0,
      text: `Done.\n<<step-done id="${turn?.childAgentId}" status="returned" needs="user">>\nWhich export?`,
    });

    expect(world.state.ports.childTurns).toHaveLength(1);
    expect(world.errors).toEqual([]);
  });
});
