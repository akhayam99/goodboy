import { describe, expect, it } from 'vitest';
import { EMPTY_USER_FACTS } from '@goodboy/core/auto';
import {
  getAutoAttempt,
  getAutoTree,
  listAutoAttemptsOfTree,
  listAutoDelegations,
  listAutoLaunchSnapshotsOfTree,
} from '@goodboy/db';
import { AUTO_SEED_ROOT } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type MessageAttachment, type SessionId, type WorkspaceId } from '@goodboy/types';
import { readAutoTreeViews } from '../../../slices/auto-view/readAutoTreeViews';
import { writeRunGuidance } from '../../runGuidance/writeRunGuidance';
import { childImagesOf } from '../childImagesOf';
import { addOutboxRow } from '../testing/deliveryWorld';
import {
  autoDelegates,
  autoTurnEnds,
  makeRuntimeWorld,
  restartedWorld,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

const BANNER: MessageAttachment = {
  id: 'attachment-banner',
  kind: 'image',
  fileName: 'banner-wide.png',
  mimeType: 'image/png',
  relPath: 'attachments/banner-wide.png',
  dir: '/scratch/session-harborline',
};

const TOTALS: MessageAttachment = {
  id: 'attachment-totals',
  kind: 'image',
  fileName: 'totals-narrow.png',
  mimeType: 'image/png',
  relPath: 'attachments/totals-narrow.png',
  dir: '/scratch/session-harborline',
};

const ONE_WRITER = {
  children: [
    {
      role: 'implementer',
      task: 'fix the banner overlap in ledger-core',
      reason: 'the user sent the overlap',
      mount: 'mount-ledger-core',
    },
  ],
};

type UserRowParams = {
  readonly world: RuntimeWorld;
  readonly id: string;
  readonly text: string;
  readonly images: ReadonlyArray<MessageAttachment>;
  readonly atMs?: number;
};

const addUserImageRow = ({ world, id, text, images, atMs }: UserRowParams) =>
  addOutboxRow({
    world: world.state.world,
    id,
    kind: 'user',
    payload: { kind: 'user', text, facts: EMPTY_USER_FACTS, images },
    ...(atMs === undefined ? {} : { atMs }),
  });

const askedWithBanner = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await writeRunGuidance({
    db: world.state.world.db,
    workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
    agentId: AUTO_SEED_ROOT,
    text: 'Use pnpm, never npm.',
  });
  await addUserImageRow({
    world,
    id: 'outbox-user-banner',
    text: 'The banner overlaps the totals on narrow screens.',
    images: [BANNER],
  });
  await world.runtime.drive(world.treeId);
  await world.runtime.settled();
  return world;
};

const onlyAttempt = async (world: RuntimeWorld) => {
  const attempts = await listAutoAttemptsOfTree({
    db: world.state.world.db,
    treeId: world.treeId,
  });
  const attempt = attempts[0];
  if (attempts.length !== 1 || attempt === undefined) {
    throw new Error('one attempt was expected');
  }
  return attempt;
};

describe('the launch snapshot of an attempt', () => {
  it('stores what the launch handed over, the same images the child got', async () => {
    const world = await askedWithBanner();
    await autoDelegates({ world, spec: ONE_WRITER });
    await autoTurnEnds({ world });

    const attempt = await onlyAttempt(world);
    const [delegation] = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    const turn = world.state.ports.childTurns[0];

    expect(turn?.images).toEqual([BANNER]);
    expect(attempt.launchSnapshot).toMatchObject({
      schemaVersion: 1,
      images: turn?.images,
      routing: {
        provider: delegation?.routing['provider'],
        model: delegation?.routing['model'],
      },
    });
    expect(attempt.launchSnapshot).toMatchObject({
      items: [
        {
          kind: 'note',
          ref: 'outbox-user-banner',
          label: 'The banner overlaps the totals on narrow screens.',
        },
        { kind: 'image', ref: 'attachment-banner', label: 'banner-wide.png' },
        { kind: 'guidance', label: 'Use pnpm, never npm.', detail: 'run guidance' },
      ],
    });
    expect(world.errors).toEqual([]);
  });

  it('never changes once written, even when the images of the tree change later', async () => {
    const world = await askedWithBanner();
    await autoDelegates({ world, spec: ONE_WRITER });
    await autoTurnEnds({ world });
    const before = (await onlyAttempt(world)).launchSnapshot;
    const tree = await getAutoTree({ db: world.state.world.db, treeId: world.treeId });
    const [delegation] = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    if (tree === null || delegation === undefined) {
      throw new Error('a tree with one delegation was expected');
    }

    await addUserImageRow({
      world,
      id: 'outbox-user-totals',
      text: 'Here is the totals screen too.',
      images: [TOTALS],
      atMs: delegation.createdAt - 1,
    });
    await world.state.world.db.execute(
      `UPDATE auto_outbox SET state = 'accepted' WHERE id = 'outbox-user-totals'`,
    );

    expect(await childImagesOf({ ctx: world.state.ctx, tree, delegation })).toContainEqual(TOTALS);
    expect(before).toMatchObject({ images: [BANNER] });
    expect((await onlyAttempt(world)).launchSnapshot).toEqual(before);
  });

  it('relaunches an attempt that never got a run with the images it stored, never the ones of now', async () => {
    const world = await askedWithBanner();
    await autoDelegates({ world, spec: ONE_WRITER });
    const [delegation] = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    if (delegation === undefined) {
      throw new Error('one delegation was expected');
    }
    const started = await world.state.ctx.scheduler.startAttempt({
      treeId: world.treeId,
      delegationId: delegation.id,
      generation: 1,
      baseline: null,
      writeSet: null,
      launchSnapshot: { schemaVersion: 1, items: [], images: [BANNER], routing: {} },
    });
    expect(started.kind).toBe('started');
    await addUserImageRow({
      world,
      id: 'outbox-user-totals',
      text: 'Here is the totals screen too.',
      images: [TOTALS],
      atMs: delegation.createdAt - 1,
    });
    await world.state.world.db.execute(
      `UPDATE auto_outbox SET state = 'accepted' WHERE id = 'outbox-user-totals'`,
    );
    await world.state.world.db.execute(
      `UPDATE auto_trees SET active_run_id = NULL, active_delivery_id = NULL, phase = 'delegating'`,
    );
    const restarted = restartedWorld({ world });

    await restarted.runtime.recover(world.treeId);
    await restarted.runtime.settled();

    expect(restarted.state.ports.childTurns.map((turn) => turn.images)).toEqual([[BANNER]]);
    const attempt = await getAutoAttempt({
      db: world.state.world.db,
      attemptId: delegation.firstAttemptId,
    });
    expect(attempt?.launchSnapshot).toMatchObject({ images: [BANNER] });
  });

  it('reaches the view by delegation, and an attempt from before reads as not recorded', async () => {
    const world = await askedWithBanner();
    await autoDelegates({ world, spec: ONE_WRITER });
    await autoTurnEnds({ world });
    const attempt = await onlyAttempt(world);

    const [view] = await readAutoTreeViews({ db: world.state.world.db, sessionId: SESSION });
    expect(view?.launchSnapshots).toEqual({ [attempt.delegationId]: attempt.launchSnapshot });

    await world.state.world.db.execute(`UPDATE auto_attempts SET launch_snapshot = NULL`);

    expect(
      await listAutoLaunchSnapshotsOfTree({ db: world.state.world.db, treeId: world.treeId }),
    ).toEqual([]);
    const [old] = await readAutoTreeViews({ db: world.state.world.db, sessionId: SESSION });
    expect(old?.launchSnapshots).toEqual({});
  });
});
