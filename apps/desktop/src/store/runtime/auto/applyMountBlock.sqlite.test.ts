import { describe, expect, it } from 'vitest';
import { isRefusalPayload, mountNoteOf } from '@goodboy/core/auto';
import { listAutoOutbox } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { writeAutoLevel } from './level/writeAutoLevel';
import type { MountProjectOutcome } from './ports';
import {
  autoTurnEndsWithBlock,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const MOUNT = {
  action: 'mount',
  project: 'ledger-core',
  branch: 'ak/feat-new-explore',
  reason: 'The user asked for a worktree.',
};

const mountTurn = async (
  level: 'step' | 'plan' | 'run',
  outcome: MountProjectOutcome,
): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await writeAutoLevel({
    db: world.state.world.db,
    target: { sessionId: AUTO_SEED_SESSION },
    level,
  });
  world.state.ports.setMountProjectOutcome(outcome);
  await userSays({ world, id: 'outbox-user-1', text: 'create a worktree on ledger-core' });
  await autoTurnEndsWithBlock({ world, block: MOUNT });
  return world;
};

const refusalOf = async (world: RuntimeWorld) => {
  const rows = (await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })).filter(
    (row) => row.kind === 'refusal',
  );
  const payload = rows[0]?.payload;
  if (!isRefusalPayload(payload)) {
    throw new Error('expected one refusal row');
  }
  return { count: rows.length, payload, mount: mountNoteOf({ value: payload.mount }) };
};

describe('the mount action of the block', () => {
  it('mounts at once at Never with the branch the user named and says it is done', async () => {
    const world = await mountTurn('run', {
      kind: 'mounted',
      name: 'ledger-core',
      branch: 'ak/feat-new-explore',
    });

    expect(world.state.ports.mountProjectCalls).toEqual([
      {
        sessionId: AUTO_SEED_SESSION,
        name: 'ledger-core',
        branch: 'ak/feat-new-explore',
        reason: MOUNT.reason,
        mode: 'mount',
      },
    ]);
    const refusal = await refusalOf(world);
    expect(refusal.mount).toMatchObject({ state: 'done', branch: 'ak/feat-new-explore' });
    expect(refusal.payload.text).toContain('Mounted ledger-core on branch ak/feat-new-explore');
    expect(world.errors).toEqual([]);
  });

  it('mounts after the plan only when the allowance covers it, else shows the card', async () => {
    const allowed = await mountTurn('plan', {
      kind: 'mounted',
      name: 'ledger-core',
      branch: 'ak/feat-new-explore',
    });
    const gated = await mountTurn('plan', { kind: 'ask', name: 'ledger-core' });

    expect(allowed.state.ports.mountProjectCalls[0]?.mode).toBe('allowance');
    expect((await refusalOf(allowed)).mount?.state).toBe('done');
    expect((await refusalOf(gated)).mount).toMatchObject({ state: 'ask', project: 'ledger-core' });
  });

  it('always shows the card at Every step', async () => {
    const world = await mountTurn('step', { kind: 'ask', name: 'ledger-core' });

    expect(world.state.ports.mountProjectCalls[0]?.mode).toBe('ask');
    const refusal = await refusalOf(world);
    expect(refusal.payload.code).toBe('mount_missing');
    expect(refusal.mount).toMatchObject({ state: 'ask', branch: 'ak/feat-new-explore' });
  });

  it('keeps the card with the reason when the mount fails', async () => {
    const world = await mountTurn('run', {
      kind: 'failed',
      name: 'ledger-core',
      error: 'the branch is in use',
    });

    const refusal = await refusalOf(world);
    expect(refusal.mount?.state).toBe('ask');
    expect(refusal.payload.text).toContain('the branch is in use');
  });

  it('falls back to the folder list when the project is unknown', async () => {
    const world = await mountTurn('run', { kind: 'unknown' });

    const refusal = await refusalOf(world);
    expect(refusal.payload.code).toBe('mount_missing');
    expect(refusal.mount).toBeNull();
  });

  it('writes exactly one row for the turn', async () => {
    const world = await mountTurn('run', { kind: 'unknown' });

    expect((await refusalOf(world)).count).toBe(1);
  });
});
