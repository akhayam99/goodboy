import { describe, expect, it } from 'vitest';
import {
  getArtifact,
  getAutoArtifact,
  getAutoDelegation,
  getAutoTree,
  listAutoArtifactVersions,
  listAutoDelegations,
  writeArtifactRevision,
} from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type ArtifactId } from '@goodboy/types';
import { finishAttempt } from './finishAttempt';
import { prepareRetry } from './prepareRetry';
import { batchInput, childInput, registerPlan, WORLD_NOW } from './testing/autoWorld';
import {
  autoCommand,
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const PLAN_ID = brandId<ArtifactId>({ value: 'plan-1' });

const newPlan = (content: string, extra: Readonly<Record<string, unknown>> = {}) =>
  `Here is the new plan.\n<<artifact v=1 kind=plan>>\n${JSON.stringify({
    title: 'Plan for notify-relay',
    format: 'markdown',
    content,
    ...extra,
  })}\n<</artifact>>\n<<step-done id="agent-planner">>`;

const REVISE = {
  children: [
    {
      reason: 'the user asked for a change',
      revises: { artifactId: 'plan-1', expectedRevision: 1 },
      changeFrom: ['outbox-user-1'],
      task: 'shorten step two only',
    },
  ],
};

const revisingWorld = async (): Promise<RuntimeWorld> => {
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
  await db.execute(
    `UPDATE auto_trees SET phase = 'answering', is_yield_requested = 0, turn_delegate_calls = 0`,
  );
  await userSays({ world, id: 'outbox-user-1', text: 'make step two shorter' });
  await autoDelegates({ world, spec: REVISE });
  await autoTurnEnds({ world });
  return world;
};

const planOf = async (world: RuntimeWorld) =>
  getArtifact({ db: world.state.world.db, artifactId: PLAN_ID });

describe('revising an artifact the tree already has', () => {
  it('starts the producer on a revise turn that leaves the legacy capture alone', async () => {
    const world = await revisingWorld();

    const turn = world.state.ports.childTurns[0];

    expect(turn).toMatchObject({
      childAgentId: 'agent-planner',
      role: 'planner',
      captureMode: 'revise',
    });
    expect(turn?.text).toContain('Revise the plan Plan for notify-relay, now at version 1');
    expect(turn?.text).toContain('make step two shorter');
    expect(world.errors).toEqual([]);
  });

  it('lands the new version as revision 2 of the same artifact and tells Auto', async () => {
    const world = await revisingWorld();
    const refreshed = world.state.ports.refreshes.length;

    await childTurnEnds({
      world,
      index: 0,
      text: newPlan('# Plan v2\n\n- step one\n- step two, shorter\n'),
    });

    expect(await planOf(world)).toMatchObject({
      revision: 2,
      sourceText: '# Plan v2\n\n- step one\n- step two, shorter',
      status: 'active',
    });
    expect(await getAutoArtifact({ db: world.state.world.db, artifactId: PLAN_ID })).toMatchObject({
      approvalState: 'needs_approval',
      openReviseDelegationId: null,
    });
    expect(
      await listAutoArtifactVersions({ db: world.state.world.db, artifactId: PLAN_ID }),
    ).toMatchObject([{ revision: 2, baseRevision: 1 }]);
    const text = world.state.ports.autoTurns[1]?.text ?? '';
    expect(text).toContain('version 2 from version 1');
    const delegation = (
      await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId })
    ).find((row) => row.reviseOf === 'plan-1');
    expect(delegation).toMatchObject({ state: 'settled', outcome: 'completed' });
    expect(world.state.ports.refreshes.slice(refreshed)).toEqual([
      { sessionId: AUTO_SEED_SESSION },
    ]);
    expect(world.errors).toEqual([]);
  });

  it('fails a prose reply as no new version and leaves the artifact at its version', async () => {
    const world = await revisingWorld();

    await childTurnEnds({
      world,
      index: 0,
      text: 'The plan already says that.\n<<step-done id="agent-planner">>',
    });

    expect(await planOf(world)).toMatchObject({ revision: 1 });
    expect(await getAutoArtifact({ db: world.state.world.db, artifactId: PLAN_ID })).toMatchObject({
      approvalState: 'needs_approval',
      openReviseDelegationId: null,
    });
    const delegation = (
      await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId })
    ).find((row) => row.reviseOf === 'plan-1');
    expect(delegation).toMatchObject({
      state: 'settled',
      outcome: 'failed',
      reason: 'no_new_version',
    });
    expect(world.state.ports.autoTurns[1]?.text).toContain('no_new_version');
  });

  it('drops the result for a base the user edited meanwhile and keeps the edit', async () => {
    const world = await revisingWorld();
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
    const refreshed = world.state.ports.refreshes.length;

    await childTurnEnds({ world, index: 0, text: newPlan('# Plan v2 from the old base\n') });

    expect(world.state.ports.refreshes).toHaveLength(refreshed);

    expect(await planOf(world)).toMatchObject({
      revision: 2,
      sourceText: '# Plan edited by hand\n',
    });
    const delegation = (
      await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId })
    ).find((row) => row.reviseOf === 'plan-1');
    expect(delegation).toMatchObject({ state: 'settled', outcome: 'failed', reason: 'stale_base' });
    expect(
      await getAutoDelegation({ db: world.state.world.db, delegationId: delegation!.id }),
    ).not.toBeNull();
    expect(
      await listAutoArtifactVersions({ db: world.state.world.db, artifactId: PLAN_ID }),
    ).toEqual([]);
  });

  it('refuses a plan that lost its parallel parts and writes nothing', async () => {
    const world = await revisingWorld();
    await world.state.world.db.execute(
      `UPDATE session_artifacts SET metadata_json = ? WHERE id = 'plan-1'`,
      [
        JSON.stringify({
          clusters: [
            { title: 'part a', instructions: 'a' },
            { title: 'part b', instructions: 'b' },
          ],
        }),
      ],
    );

    await childTurnEnds({ world, index: 0, text: newPlan('# Plan v2 without parts\n') });

    expect(await planOf(world)).toMatchObject({ revision: 1 });
    const delegation = (
      await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId })
    ).find((row) => row.reviseOf === 'plan-1');
    expect(delegation).toMatchObject({ outcome: 'failed', reason: 'lost_structure' });
  });

  describe('when the window died between the attempt and the landing', () => {
    const crashAfterAttempt = async (world: RuntimeWorld) => {
      const turn = world.state.ports.childTurns[0];
      if (turn === undefined) {
        throw new Error('a child was expected');
      }
      const scheduler = {
        ...world.state.ctx.scheduler,
        landRevision: async (): Promise<never> => {
          throw new Error('the window died');
        },
      };
      await expect(
        finishAttempt({
          ctx: { ...world.state.ctx, scheduler },
          ended: {
            treeId: turn.treeId,
            generation: turn.generation,
            delegationId: turn.delegationId,
            attemptId: turn.attemptId,
            runId: turn.runId,
            childAgentId: turn.childAgentId,
            sessionId: turn.sessionId,
            assistantText: newPlan('# Plan v2\n\n- step one\n- step two, shorter'),
            exit: 'ok',
            costUsd: 0.2,
            filesTouched: [],
            durationMs: 10,
          },
        }),
      ).rejects.toThrow('the window died');
    };

    it('lands the stored version after the restart and tells Auto once', async () => {
      const world = await revisingWorld();
      await crashAfterAttempt(world);
      expect(await planOf(world)).toMatchObject({ revision: 1 });

      const restarted = restartedWorld({ world });
      await restarted.runtime.recover(world.treeId);
      await restarted.runtime.settled();

      expect(await planOf(world)).toMatchObject({
        revision: 2,
        sourceText: '# Plan v2\n\n- step one\n- step two, shorter',
      });
      expect(restarted.state.ports.autoTurns).toHaveLength(1);
      expect(restarted.state.ports.autoTurns[0]?.text).toContain('version 2 from version 1');
      expect(restarted.state.ports.refreshes).toContainEqual({ sessionId: AUTO_SEED_SESSION });
    });

    it('drops the stored version when the user edited the artifact meanwhile', async () => {
      const world = await revisingWorld();
      await crashAfterAttempt(world);
      await writeArtifactRevision({
        db: world.state.world.db,
        artifactId: PLAN_ID,
        expectedRevision: 1,
        author: 'user',
        title: 'Plan for notify-relay',
        sourceText: '# Plan edited by hand\n',
        metadata: {},
        nowMs: WORLD_NOW,
      });

      const restarted = restartedWorld({ world });
      await restarted.runtime.recover(world.treeId);
      await restarted.runtime.settled();

      expect(await planOf(world)).toMatchObject({
        revision: 2,
        sourceText: '# Plan edited by hand\n',
      });
      expect(restarted.state.ports.autoTurns[0]?.text).toContain('stale_base');
    });

    it('does not apply the same version twice when it recovers a second time', async () => {
      const world = await revisingWorld();
      await crashAfterAttempt(world);
      const first = restartedWorld({ world });
      await first.runtime.recover(world.treeId);
      await first.runtime.settled();
      const second = restartedWorld({ world: first });

      await second.runtime.recover(world.treeId);
      await second.runtime.settled();

      expect(await planOf(world)).toMatchObject({ revision: 2 });
      expect(
        await listAutoArtifactVersions({ db: world.state.world.db, artifactId: PLAN_ID }),
      ).toHaveLength(1);
    });
  });
});

describe('retrying a revise', () => {
  const reviseDelegation = async (world: RuntimeWorld) => {
    const delegation = (
      await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId })
    ).find((row) => row.reviseOf === 'plan-1' && row.retryOf === null);
    if (delegation === undefined) {
      throw new Error('a revise was expected');
    }
    return delegation;
  };

  const retryRevise = async (world: RuntimeWorld, requestId = 'request-retry') =>
    autoCommand({
      world,
      verb: 'delegate',
      args: {
        'request-id': requestId,
        spec: JSON.stringify({
          children: [{ retryOf: (await reviseDelegation(world)).id, reason: 'the user edited' }],
        }),
      },
    });

  it('re-reads the base when the user edited meanwhile, so the retry includes the edit', async () => {
    const world = await revisingWorld();
    await writeArtifactRevision({
      db: world.state.world.db,
      artifactId: PLAN_ID,
      expectedRevision: 1,
      author: 'user',
      title: 'Plan for notify-relay',
      sourceText: '# Plan edited by hand\n',
      metadata: {},
      nowMs: WORLD_NOW,
    });
    await childTurnEnds({ world, index: 0, text: newPlan('# Plan v2 from the old base\n') });
    expect(await reviseDelegation(world)).toMatchObject({
      outcome: 'failed',
      reason: 'stale_base',
    });

    const outcome = await retryRevise(world);

    expect(outcome).toMatchObject({ isOk: true, data: { accepted: true } });
    const retried = (
      await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId })
    ).find((row) => row.retryOf !== null);
    expect(retried).toMatchObject({ reviseOf: 'plan-1', baseRevision: 2, state: 'accepted' });

    await autoTurnEnds({ world });

    const turn = world.state.ports.childTurns[1];
    expect(turn).toMatchObject({ childAgentId: 'agent-planner', captureMode: 'revise' });
    expect(turn?.text).toContain('now at version 2');
    expect(turn?.text).toContain('# Plan edited by hand');
    await childTurnEnds({ world, index: 1, text: newPlan('# Plan v3 on top of the edit\n') });
    expect(await planOf(world)).toMatchObject({
      revision: 3,
      sourceText: '# Plan v3 on top of the edit',
    });
    expect(world.errors).toEqual([]);
  });

  it('returns the landed version instead of repeating a revise that already applied', async () => {
    const world = await revisingWorld();
    await childTurnEnds({ world, index: 0, text: newPlan('# Plan v2\n\n- step two, shorter\n') });
    expect(await planOf(world)).toMatchObject({ revision: 2 });
    const before = await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

    const outcome = await retryRevise(world);

    expect(outcome).toMatchObject({
      isOk: true,
      data: { accepted: false, recovered: [{ artifactId: 'plan-1', revision: 2 }] },
    });
    expect(await planOf(world)).toMatchObject({ revision: 2 });
    expect(
      await listAutoArtifactVersions({ db: world.state.world.db, artifactId: PLAN_ID }),
    ).toHaveLength(1);
    expect(
      await listAutoDelegations({ db: world.state.world.db, treeId: world.treeId }),
    ).toHaveLength(before.length);
    expect(await getAutoTree({ db: world.state.world.db, treeId: world.treeId })).toMatchObject({
      delegationsUsed: before.length,
    });
  });

  it('waits for the landing after a crash, then returns the version it landed', async () => {
    const world = await revisingWorld();
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    const scheduler = {
      ...world.state.ctx.scheduler,
      landRevision: async (): Promise<never> => {
        throw new Error('the window died');
      },
    };
    await expect(
      finishAttempt({
        ctx: { ...world.state.ctx, scheduler },
        ended: {
          treeId: turn.treeId,
          generation: turn.generation,
          delegationId: turn.delegationId,
          attemptId: turn.attemptId,
          runId: turn.runId,
          childAgentId: turn.childAgentId,
          sessionId: turn.sessionId,
          assistantText: newPlan('# Plan v2\n\n- step two, shorter'),
          exit: 'ok',
          costUsd: 0.2,
          filesTouched: [],
          durationMs: 10,
        },
      }),
    ).rejects.toThrow('the window died');
    const tree = await getAutoTree({ db: world.state.world.db, treeId: world.treeId });
    if (tree === null) {
      throw new Error('a tree was expected');
    }
    const early = await prepareRetry({
      ctx: world.state.ctx,
      tree,
      child: {
        role: null,
        task: '',
        reason: 'again',
        provider: null,
        model: null,
        effort: null,
        taskType: null,
        difficulty: null,
        doneWhen: null,
        expected: null,
        artifactIds: [],
        mount: null,
        revises: null,
        changeFrom: [],
        retryOf: (await reviseDelegation(world)).id,
      },
      slot: 0,
    });
    expect(early).toMatchObject({ kind: 'refused', refusal: { code: 'retry_unavailable' } });

    const restarted = restartedWorld({ world });
    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();
    const outcome = await retryRevise(restarted);

    expect(outcome).toMatchObject({
      isOk: true,
      data: { accepted: false, recovered: [{ revision: 2 }] },
    });
    expect(await planOf(world)).toMatchObject({ revision: 2 });
    expect(
      await listAutoArtifactVersions({ db: world.state.world.db, artifactId: PLAN_ID }),
    ).toHaveLength(1);
  });
});
