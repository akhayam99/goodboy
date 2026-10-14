import { describe, expect, it } from 'vitest';
import { EMPTY_USER_FACTS } from '@goodboy/core';
import { getAutoArtifact, getAutoDelegation, insertAutoOutbox } from '@goodboy/db';
import { brandId, type ArtifactId, type AutoDelegationId, type AutoOutboxId } from '@goodboy/types';
import { executeAgentCommand } from './executeAgentCommand';
import type { AgentCommand } from './ports';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  registerPlan,
  WORLD_NOW,
  WORLD_TREE,
  type AutoWorld,
} from './testing/autoWorld';
import { makeFakePorts, WORLD_GRANT, type FakePorts } from './testing/fakePorts';
import type { AgentVerbContext } from './verbContext';

const PLAN_SOURCE = '# Plan\n\n- step one\n- step two\n';

type Setup = Readonly<{
  world: AutoWorld;
  ports: FakePorts;
  ctx: AgentVerbContext;
}>;

const setup = async (): Promise<Setup> => {
  const world = await makeAutoWorld({
    agentIds: ['agent-planner'],
    planIds: [{ id: 'plan-1', agentId: 'agent-planner' }],
  });
  const ports = makeFakePorts();
  await world.scheduler.admit(
    batchInput({
      requestId: 'request-plan',
      children: [childInput({ key: 'plan', role: 'planner', agentId: 'agent-planner' })],
    }),
  );
  await registerPlan({
    world,
    id: 'plan-1',
    agentId: 'agent-planner',
    delegationId: 'delegation-plan',
  });
  await world.db.execute(
    `UPDATE auto_delegations SET state = 'settled', outcome = 'completed', settled_at = ? WHERE id = 'delegation-plan'`,
    [WORLD_NOW],
  );
  await world.db.execute(
    `UPDATE auto_trees SET phase = 'deciding', is_yield_requested = 0, turn_delegate_calls = 0`,
  );
  return {
    world,
    ports,
    ctx: { db: world.db, scheduler: world.scheduler, ports, now: world.clock.now },
  };
};

const userRow = async ({
  world,
  id,
  text,
  facts = EMPTY_USER_FACTS,
}: {
  readonly world: AutoWorld;
  readonly id: string;
  readonly text: string;
  readonly facts?: typeof EMPTY_USER_FACTS;
}) =>
  insertAutoOutbox({
    db: world.db,
    outbox: {
      id: brandId<AutoOutboxId>({ value: id }),
      treeId: WORLD_TREE,
      generation: 1,
      kind: 'user',
      joinKey: `user:${id}`,
      payload: { kind: 'user', text, facts },
      nowMs: WORLD_NOW,
    },
  });

const reviseCommand = (child: Record<string, unknown>): AgentCommand => ({
  verb: 'delegate',
  args: {
    'request-id': 'request-revise',
    spec: JSON.stringify({ children: [{ reason: 'the user asked for a change', ...child }] }),
  },
  grant: WORLD_GRANT,
});

const run = (state: Setup, command: AgentCommand) =>
  executeAgentCommand({ ctx: state.ctx, command, isEnabled: true });

describe('delegating a revise of an artifact the tree already has', () => {
  it('sends it to the producer with the user words verbatim and the current version', async () => {
    const state = await setup();
    await userRow({
      world: state.world,
      id: 'outbox-user-1',
      text: 'make step two shorter,\nplease',
    });
    const outcome = await run(
      state,
      reviseCommand({
        revises: { artifactId: 'plan-1', expectedRevision: 1 },
        changeFrom: ['outbox-user-1'],
        task: 'shorten step two only',
      }),
    );
    expect(outcome.isOk).toBe(true);
    const delegation = await getAutoDelegation({
      db: state.world.db,
      delegationId: brandId<AutoDelegationId>({ value: 'id-1' }),
    });
    expect(delegation).toMatchObject({
      childAgentId: 'agent-planner',
      role: 'planner',
      reviseOf: 'plan-1',
      baseRevision: 1,
      state: 'accepted',
    });
    const kickoff = String(delegation?.request['kickoff']);
    expect(kickoff).toContain('Revise the plan');
    expect(kickoff).toContain('make step two shorter,\nplease');
    expect(kickoff).toContain("**Auto's reading** shorten step two only");
    expect(kickoff).toContain(`**Current version 1**\n${PLAN_SOURCE}`);
    expect(
      await getAutoArtifact({
        db: state.world.db,
        artifactId: brandId<ArtifactId>({ value: 'plan-1' }),
      }),
    ).toMatchObject({
      approvalState: 'revising',
      openReviseDelegationId: delegation?.id,
    });
  });

  it('tells Auto the latest version when the one it names is stale', async () => {
    const state = await setup();
    const outcome = await run(
      state,
      reviseCommand({ revises: { artifactId: 'plan-1', expectedRevision: 4 } }),
    );
    expect(outcome).toMatchObject({ isOk: false, code: 'stale_revision' });
    expect(outcome.error).toContain('latest version 1');
  });

  it('refuses a revise sent to another role than the producer', async () => {
    const state = await setup();
    const outcome = await run(
      state,
      reviseCommand({
        role: 'implementer',
        revises: { artifactId: 'plan-1', expectedRevision: 1 },
      }),
    );
    expect(outcome).toMatchObject({ isOk: false, code: 'role_mismatch' });
  });

  it('refuses an artifact of another conversation and a message that is not in this one', async () => {
    const state = await setup();
    const elsewhere = await run(
      state,
      reviseCommand({ revises: { artifactId: 'plan-elsewhere', expectedRevision: 1 } }),
    );
    expect(elsewhere).toMatchObject({ isOk: false, code: 'artifact_unknown' });
    const noRow = await run(
      state,
      reviseCommand({
        revises: { artifactId: 'plan-1', expectedRevision: 1 },
        changeFrom: ['outbox-missing'],
      }),
    );
    expect(noRow).toMatchObject({ isOk: false, code: 'spec_invalid' });
  });

  it('holds the revise behind a confirm card when the message could mean more than one artifact', async () => {
    const state = await setup();
    await userRow({
      world: state.world,
      id: 'outbox-user-2',
      text: 'change the plan',
      facts: { ...EMPTY_USER_FACTS, isAmbiguous: true },
    });
    const outcome = await run(
      state,
      reviseCommand({
        revises: { artifactId: 'plan-1', expectedRevision: 1 },
        changeFrom: ['outbox-user-2'],
      }),
    );
    expect(outcome.data).toMatchObject({ delegations: [{ state: 'awaiting_confirm' }] });
  });

  it('does not hold it when the user had the artifact open', async () => {
    const state = await setup();
    await userRow({
      world: state.world,
      id: 'outbox-user-3',
      text: 'change the plan',
      facts: { ...EMPTY_USER_FACTS, isAmbiguous: true, focusArtifactId: 'plan-1' },
    });
    const outcome = await run(
      state,
      reviseCommand({
        revises: { artifactId: 'plan-1', expectedRevision: 1 },
        changeFrom: ['outbox-user-3'],
      }),
    );
    expect(outcome.data).toMatchObject({ delegations: [{ state: 'accepted' }] });
  });

  it('lets Auto read the artifact it revises, only in its own tree', async () => {
    const state = await setup();
    const own = await run(state, {
      verb: 'status',
      args: { artifact: 'plan-1' },
      grant: WORLD_GRANT,
    });
    expect(own.data).toMatchObject({
      artifactId: 'plan-1',
      kind: 'plan',
      revision: 1,
      approval: 'needs_approval',
      body: PLAN_SOURCE,
    });
  });
});
