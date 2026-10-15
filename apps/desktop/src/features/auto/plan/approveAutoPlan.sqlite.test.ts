import { describe, expect, it, vi } from 'vitest';
import { getAutoArtifact, writeArtifactRevision } from '@goodboy/db';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type ArtifactId } from '@goodboy/types';
import {
  makeAutoWorld,
  registerPlan,
  WORLD_NOW,
  type AutoWorld,
} from '../../../store/slices/auto/testing/autoWorld';
import { approveAutoPlan } from './approveAutoPlan';

const PLAN = brandId<ArtifactId>({ value: 'plan-1' });

const worldWithPlan = async (): Promise<AutoWorld> => {
  const world = await makeAutoWorld({
    agentIds: ['agent-planner'],
    planIds: [{ id: 'plan-1', agentId: 'agent-planner' }],
  });
  await registerPlan({ world, id: 'plan-1', agentId: 'agent-planner' });
  return world;
};

type ApproveParams = {
  readonly world: AutoWorld;
  readonly revision?: number;
  readonly send?: () => Promise<void>;
};

const approve = ({ world, revision = 1, send = async () => undefined }: ApproveParams) =>
  approveAutoPlan({
    db: world.db,
    sessionId: AUTO_SEED_SESSION,
    rootAgentId: AUTO_SEED_ROOT,
    artifactId: PLAN,
    expectedRevision: revision,
    send,
  });

describe('approveAutoPlan', () => {
  it('approves the revision and then tells Auto once, naming the version', async () => {
    const world = await worldWithPlan();
    const send = vi.fn(async () => undefined);

    const result = await approve({ world, send });

    expect(result).toEqual({ kind: 'approved', revision: 1 });
    expect(send).toHaveBeenCalledExactlyOnceWith({
      sessionId: AUTO_SEED_SESSION,
      agentId: AUTO_SEED_ROOT,
      content: 'Approved plan v1.',
    });
    expect(await getAutoArtifact({ db: world.db, artifactId: PLAN })).toMatchObject({
      approvalState: 'approved',
      approvedRevision: 1,
    });
  });

  it('refuses a stale version without telling Auto, and says a newer version arrived', async () => {
    const world = await worldWithPlan();
    await writeArtifactRevision({
      db: world.db,
      artifactId: PLAN,
      expectedRevision: 1,
      author: 'user',
      title: 'Plan for notify-relay',
      sourceText: '# Plan v2\n',
      metadata: {},
      nowMs: WORLD_NOW,
    });
    const send = vi.fn(async () => undefined);

    const result = await approve({ world, revision: 1, send });

    expect(result).toMatchObject({
      kind: 'refused',
      code: 'stale_revision',
      message: 'A newer version arrived. Review it before approving.',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the approval and says so when Auto could not be told', async () => {
    const world = await worldWithPlan();

    const result = await approve({
      world,
      send: async () => {
        throw new Error('the composer is closed');
      },
    });

    expect(result.kind).toBe('told_failed');
    expect(await getAutoArtifact({ db: world.db, artifactId: PLAN })).toMatchObject({
      approvalState: 'approved',
    });
  });

  it('does not tell Auto twice when the other window already approved the same version', async () => {
    const world = await worldWithPlan();
    const sendA = vi.fn(async () => undefined);
    const sendB = vi.fn(async () => undefined);

    const first = await approve({ world, send: sendA });
    const second = await approve({ world, send: sendB });

    expect(first.kind).toBe('approved');
    expect(second).toEqual({ kind: 'already_approved', revision: 1 });
    expect(sendA).toHaveBeenCalledOnce();
    expect(sendB).not.toHaveBeenCalled();
  });

  it('refuses a plan that is not part of an Auto conversation', async () => {
    const world = await worldWithPlan();

    const result = await approveAutoPlan({
      db: world.db,
      sessionId: AUTO_SEED_SESSION,
      rootAgentId: AUTO_SEED_ROOT,
      artifactId: brandId<ArtifactId>({ value: 'plan-unknown' }),
      expectedRevision: 1,
      send: async () => undefined,
    });

    expect(result).toMatchObject({
      kind: 'refused',
      message: 'This plan is not part of an Auto conversation.',
    });
  });
});
