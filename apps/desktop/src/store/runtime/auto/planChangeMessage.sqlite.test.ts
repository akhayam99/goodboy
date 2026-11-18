import { describe, expect, it } from 'vitest';
import { getArtifact, listAutoOutbox, writeArtifactRevision } from '@goodboy/db';
import { brandId, type ArtifactId } from '@goodboy/types';
import { batchInput, childInput, registerPlan, WORLD_NOW } from './testing/autoWorld';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const PLAN_ID = brandId<ArtifactId>({ value: 'plan-1' });

const CHANGE = 'follow the project guidelines and reuse the patterns used elsewhere';

type PhaseParams = {
  readonly phase: string;
};

const planWaitingWorld = async ({ phase }: PhaseParams): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({
    agentIds: ['agent-planner'],
    planIds: [{ id: 'plan-1', agentId: 'agent-planner' }],
  });
  const db = world.state.world.db;
  await world.state.world.scheduler.admit(
    batchInput({
      requestId: 'request-plan',
      children: [childInput({ key: 'plan', role: 'planner', agentId: 'agent-planner' })],
    }),
  );
  await registerPlan({
    world: world.state.world,
    id: 'plan-1',
    agentId: 'agent-planner',
    delegationId: 'delegation-plan',
  });
  await db.execute(
    `UPDATE auto_delegations SET state = 'settled', outcome = 'completed', settled_at = ? WHERE id = 'delegation-plan'`,
    [WORLD_NOW],
  );
  await db.execute(`UPDATE auto_artifacts SET approval_state = 'needs_approval'`);
  await db.execute(
    `UPDATE auto_trees SET phase = ?, is_yield_requested = 0, turn_delegate_calls = 0`,
    [phase],
  );
  return world;
};

type SayParams = {
  readonly world: RuntimeWorld;
  readonly text: string;
};

const say = async ({ world, text }: SayParams): Promise<string> => {
  const outcome = await world.runtime.say({ treeId: world.treeId, text });
  await world.runtime.settled();
  if (outcome.kind !== 'queued') {
    throw new Error('the message was lost');
  }
  return outcome.rowId;
};

type PlanParams = {
  readonly content: string;
};

const newPlan = ({ content }: PlanParams): string =>
  `Here is the new plan.\n<<artifact v=1 kind=plan>>\n${JSON.stringify({
    title: 'Plan for notify-relay',
    format: 'markdown',
    content,
  })}\n<</artifact>>\n<<step-done id="agent-planner">>`;

describe('a message to the Lead while its plan waits for approval', () => {
  it.each(['done', 'answering', 'waiting', 'merging'])(
    'starts the Lead at once with the message as changes to plan v1 (%s)',
    async (phase) => {
      const world = await planWaitingWorld({ phase });

      const rowId = await say({ world, text: CHANGE });

      const turn = world.state.ports.autoTurns.at(-1);
      expect(world.state.ports.autoTurns).toHaveLength(1);
      expect(turn?.text).toContain(CHANGE);
      expect(turn?.text).toContain(
        `this asks for changes to plan-1 v1: delegate one child {"revises":{"artifactId":"plan-1","expectedRevision":1},"changeFrom":["${rowId}"],"task":"<what to change>","reason":"<why>"}`,
      );
      expect(world.errors).toEqual([]);
    },
  );

  it('revises the plan into v2, and the next message asks for changes to v2', async () => {
    const world = await planWaitingWorld({ phase: 'done' });
    const rowId = await say({ world, text: CHANGE });

    await autoDelegates({
      world,
      spec: {
        children: [
          {
            reason: 'the user asked for changes to the plan',
            revises: { artifactId: 'plan-1', expectedRevision: 1 },
            changeFrom: [rowId],
            task: 'follow the guidelines',
          },
        ],
      },
    });
    await autoTurnEnds({ world });
    await childTurnEnds({
      world,
      index: 0,
      text: newPlan({ content: '# Plan v2 with the guidelines\n' }),
    });

    expect((await getArtifact({ db: world.state.world.db, artifactId: PLAN_ID }))?.revision).toBe(
      2,
    );
    await autoTurnEnds({ world });
    await say({ world, text: 'one more change' });
    expect(world.state.ports.autoTurns.at(-1)?.text).toContain(
      'this asks for changes to plan-1 v2',
    );
  });

  it('makes plan v2 from a replan that names the plan by id only and gives no reason', async () => {
    const world = await planWaitingWorld({ phase: 'done' });
    const rowId = await say({ world, text: CHANGE });

    await autoDelegates({
      world,
      spec: {
        children: [
          {
            role: 'planner',
            revises: 'plan-1',
            changeFrom: [rowId],
            task: 'write a new plan with everything we said',
          },
        ],
      },
    });
    await autoTurnEnds({ world });
    await childTurnEnds({
      world,
      index: 0,
      text: newPlan({ content: '# Plan v2 from the conversation\n' }),
    });

    expect((await getArtifact({ db: world.state.world.db, artifactId: PLAN_ID }))?.revision).toBe(
      2,
    );
    expect(world.errors).toEqual([]);
  });

  it('waits while the Lead is working, as any message does', async () => {
    const world = await planWaitingWorld({ phase: 'deciding' });

    await say({ world, text: CHANGE });

    expect(world.state.ports.autoTurns).toHaveLength(0);
    const rows = await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId });
    expect(rows.filter((row) => row.kind === 'user').map((row) => row.state)).toEqual(['pending']);
  });

  it('drops the change to v1 when v2 landed before the Lead read it', async () => {
    const world = await planWaitingWorld({ phase: 'deciding' });
    await say({ world, text: CHANGE });
    const edit = await writeArtifactRevision({
      db: world.state.world.db,
      artifactId: PLAN_ID,
      expectedRevision: 1,
      author: 'user',
      title: 'Plan for notify-relay',
      sourceText: '# Plan edited by hand\n',
      metadata: {},
      nowMs: WORLD_NOW,
    });
    expect(edit.kind).toBe('saved');

    await world.state.world.db.execute(`UPDATE auto_trees SET phase = 'answering'`);
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    const text = world.state.ports.autoTurns.at(-1)?.text ?? '';
    expect(text).toContain(CHANGE);
    expect(text).not.toContain('this asks for changes to plan-1 v1');
  });
});
