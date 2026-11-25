import { beforeEach, describe, expect, it } from 'vitest';
import {
  followedGuide,
  isRefusalPayload,
  parseGuideRecord,
  startGuideRecord,
  type GuideRecord,
} from '@goodboy/core/auto';
import { insertSettingIfAbsent, listAutoOutbox, upsertWorkflow } from '@goodboy/db';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import {
  brandId,
  type IsoDateTime,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';
import { readAutoTreeViews } from '../../../slices/auto-view/readAutoTreeViews';
import { autoTreeWordOf } from '../../../../features/auto/autoTreeWordOf';
import { changeRunGuide } from '../../runGuide/changeRunGuide';
import { ensureRunGuide } from '../../runGuide/ensureRunGuide';
import { readRunGuide, readRunGuideRaw } from '../../runGuide/readRunGuide';
import { submitUserMessage } from '../submitUserMessage';
import {
  autoBlockText,
  autoDelegates,
  autoTurnEnds,
  autoTurnEndsWithBlock,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';
import { addUserRow } from '../testing/deliveryWorld';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const NOW = brandId<IsoDateTime>({ value: '2026-11-25T08:00:00.000Z' });
const FIX = brandId<WorkflowId>({ value: 'wf-fix-a-flaky-test' });
const SHIP = brandId<WorkflowId>({ value: 'wf-plan-and-ship' });

type WorkflowParams = {
  readonly id: WorkflowId;
  readonly name: string;
  readonly entryCheck?: string;
  readonly stopRule?: string;
  readonly thenSuggestId?: WorkflowId;
};

const workflowOf = ({
  id,
  name,
  entryCheck,
  stopRule,
  thenSuggestId,
}: WorkflowParams): Workflow => ({
  id,
  workspaceId: WORKSPACE,
  name,
  description: 'Steps for ledger-core.',
  goal: '',
  steps: [
    {
      id: brandId<StepId>({ value: `${id}-step-1` }),
      workflowId: id,
      role: 'investigator',
      ordinal: 0,
      name: 'Investigate',
      promptPrefix: '',
    },
    {
      id: brandId<StepId>({ value: `${id}-step-2` }),
      workflowId: id,
      role: 'implementer',
      ordinal: 1,
      name: 'Implement',
      promptPrefix: '',
    },
  ],
  isPreset: true,
  origin: 'custom',
  ...(entryCheck !== undefined && { entryCheck }),
  ...(stopRule !== undefined && { stopRule }),
  ...(thenSuggestId !== undefined && { thenSuggestId }),
  createdAt: NOW,
  updatedAt: NOW,
});

const LEAD_ROUTE = {
  shape: 'lead',
  row: 6,
  presetName: 'Fix a flaky test',
  workflowId: FIX,
  closeness: 'follow',
  role: null,
  choice: 'Lead plans it',
  why: 'The task names a test.',
};

const seedWorkflows = async (world: RuntimeWorld): Promise<void> => {
  const db = world.state.world.db;
  await upsertWorkflow(
    db,
    workflowOf({
      id: FIX,
      name: 'Fix a flaky test',
      entryCheck: 'Run the test ten times and confirm it fails at least once.',
      stopRule: 'It never fails, or it fails every time.',
      thenSuggestId: SHIP,
    }),
  );
  await upsertWorkflow(db, workflowOf({ id: SHIP, name: 'Plan and ship' }));
  await insertSettingIfAbsent({
    db,
    key: `runs.routes.${AUTO_SEED_SESSION}`,
    value: JSON.stringify({ [AUTO_SEED_ROOT]: LEAD_ROUTE }),
  });
};

const guidedWorld = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  await seedWorkflows(world);
  return world;
};

const guideOf = async (world: RuntimeWorld): Promise<GuideRecord> => {
  const guide = await readRunGuide({ db: world.state.world.db, treeId: world.treeId });
  if (guide === null) {
    throw new Error('the run has no guide record');
  }
  return guide;
};

const refusalsOf = async (world: RuntimeWorld) =>
  (await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId }))
    .filter((row) => row.kind === 'refusal')
    .flatMap((row) => (isRefusalPayload(row.payload) ? [row.payload] : []));

const IMPLEMENT = {
  children: [
    {
      role: 'implementer',
      task: 'fix the flaky ledger export test',
      reason: 'a change to the code',
      mount: 'mount-ledger-core',
    },
  ],
};

const SCOUT = {
  children: [{ role: 'scout', task: 'find the flaky test', reason: 'read only search' }],
};

describe('the record of a run that follows a workflow', () => {
  let world: RuntimeWorld;

  beforeEach(async () => {
    world = await guidedWorld();
  });

  it('is written once from the run route and the workflow, and round trips', async () => {
    const db = world.state.world.db;
    expect(await readRunGuideRaw({ db, treeId: world.treeId })).toBeNull();

    const guide = await ensureRunGuide({ db, treeId: world.treeId });

    expect(guide).toMatchObject({
      workflowId: FIX,
      name: 'Fix a flaky test',
      entryCheck: 'Run the test ten times and confirm it fails at least once.',
      stopRule: 'It never fails, or it fails every time.',
      suggestion: { id: SHIP, name: 'Plan and ship' },
      choices: [{ id: SHIP, name: 'Plan and ship' }],
      steps: [
        { name: 'Investigate', role: 'investigator' },
        { name: 'Implement', role: 'implementer' },
      ],
      isOrderKept: true,
      check: 'pending',
    });
    expect(parseGuideRecord({ raw: await readRunGuideRaw({ db, treeId: world.treeId }) })).toEqual(
      guide,
    );
    expect(await ensureRunGuide({ db, treeId: world.treeId })).toEqual(guide);
  });

  it('keeps the order of the steps only when the run was started to follow them', async () => {
    const db = world.state.world.db;
    await db.execute('UPDATE settings SET value = ? WHERE key = ?', [
      JSON.stringify({ [AUTO_SEED_ROOT]: { ...LEAD_ROUTE, closeness: 'adapt' } }),
      `runs.routes.${AUTO_SEED_SESSION}`,
    ]);

    const guide = await ensureRunGuide({ db, treeId: world.treeId });

    expect(guide?.isOrderKept).toBe(false);
  });

  it('is not written for a run without a workflow', async () => {
    const db = world.state.world.db;
    await db.execute('DELETE FROM settings WHERE key = ?', [`runs.routes.${AUTO_SEED_SESSION}`]);

    expect(await ensureRunGuide({ db, treeId: world.treeId })).toBeNull();
    expect(await readRunGuideRaw({ db, treeId: world.treeId })).toBeNull();
  });

  it('starts passed on a run that already has agents, so a run begun before it is never held up', async () => {
    const db = world.state.world.db;
    await userSays({ world, id: 'outbox-user-1', text: 'fix the flaky export test' });
    expect((await autoDelegates({ world, spec: SCOUT })).isOk).toBe(true);
    await db.execute('UPDATE auto_trees SET guide = NULL WHERE id = ?', [world.treeId]);

    const guide = await ensureRunGuide({ db, treeId: world.treeId });

    expect(guide).toMatchObject({ workflowId: FIX, check: 'passed' });
  });

  it('changes by compare and swap and names the tree it writes', async () => {
    const db = world.state.world.db;
    await ensureRunGuide({ db, treeId: world.treeId });

    const changed = await changeRunGuide({
      db,
      treeId: world.treeId,
      change: ({ guide }) => followedGuide({ guide, note: 'Failed on run four.' }),
    });

    expect(changed.kind === 'changed' && changed.guide.check).toBe('passed');
    expect((await guideOf(world)).checkNote).toBe('Failed on run four.');
  });
});

describe('a write from a turn that is no longer current', () => {
  it('is dropped once the run was stopped, and leaves the record as it was', async () => {
    const world = await guidedWorld();
    const db = world.state.world.db;
    await userSays({ world, id: 'outbox-user-1', text: 'fix the flaky export test' });
    await ensureRunGuide({ db, treeId: world.treeId });
    const turn = { generation: 1, runId: world.state.ports.autoTurns.at(-1)?.runId ?? '' };
    await db.execute("UPDATE auto_trees SET stop_state = 'requested' WHERE id = ?", [world.treeId]);

    const outcome = await changeRunGuide({
      db,
      treeId: world.treeId,
      turn,
      change: ({ guide }) => followedGuide({ guide, note: 'Failed on run four.' }),
    });

    expect(outcome.kind).toBe('stale');
    expect((await guideOf(world)).check).toBe('pending');
  });

  it('is dropped when another run owns the tree', async () => {
    const world = await guidedWorld();
    const db = world.state.world.db;
    await userSays({ world, id: 'outbox-user-1', text: 'fix the flaky export test' });
    await ensureRunGuide({ db, treeId: world.treeId });

    const outcome = await changeRunGuide({
      db,
      treeId: world.treeId,
      turn: { generation: 1, runId: 'run-from-an-older-turn' },
      change: ({ guide }) => followedGuide({ guide, note: 'Old.' }),
    });

    expect(outcome.kind).toBe('stale');
  });
});

describe('the gate before the first check', () => {
  it('refuses a writer until follow is reported, then lets it through', async () => {
    const world = await guidedWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'fix the flaky export test' });

    const before = await autoDelegates({ world, spec: IMPLEMENT });
    expect(before.isOk).toBe(false);
    expect(before.code).toBe('check_pending');

    await autoTurnEndsWithBlock({
      world,
      block: { action: 'follow', check: 'Failed on run four of ten.' },
    });
    expect((await guideOf(world)).check).toBe('passed');
    expect((await guideOf(world)).checkNote).toBe('Failed on run four of ten.');

    await addUserRow({ world: world.state.world, id: 'outbox-user-2', text: 'go on' });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();
    const after = await autoDelegates({ world, spec: IMPLEMENT, requestId: 'request-2' });
    expect(after.isOk).toBe(true);
    expect(world.errors).toEqual([]);
  });

  it('lets a scout start before the check, since it only reads', async () => {
    const world = await guidedWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'fix the flaky export test' });

    const outcome = await autoDelegates({ world, spec: SCOUT });

    expect(outcome.isOk).toBe(true);
  });

  it('reads follow written before the last block and applies it first', async () => {
    const world = await guidedWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'fix the flaky export test' });

    await autoTurnEnds({
      world,
      text: [
        'The check passed, so I note a change.',
        autoBlockText({ action: 'follow', check: 'Failed on run four.' }),
        autoBlockText({
          action: 'deviate',
          change: 'skipped',
          step: 'Investigate',
          reason: 'The report already names the cause.',
        }),
      ].join('\n'),
    });

    const guide = await guideOf(world);
    expect(guide.check).toBe('passed');
    expect(guide.deviations).toEqual([
      { change: 'skipped', step: 'Investigate', reason: 'The report already names the cause.' },
    ]);
    expect(await refusalsOf(world)).toEqual([]);
  });
});

describe('the hold block', () => {
  const holdBlock = {
    action: 'hold',
    reason: "It works as designed, so this isn't a bug.",
    suggest: 'Plan and ship',
  };

  const heldWorld = async (): Promise<RuntimeWorld> => {
    const world = await guidedWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'fix the flaky export test' });
    await autoTurnEndsWithBlock({ world, block: holdBlock, before: 'The test never fails.' });
    return world;
  };

  it('records the reason and the suggestion the user can pick', async () => {
    const world = await heldWorld();

    expect(await guideOf(world)).toMatchObject({
      check: 'held',
      holdReason: "It works as designed, so this isn't a bug.",
      holdSuggestion: { id: SHIP, name: 'Plan and ship' },
    });
    expect(world.errors).toEqual([]);
  });

  it('keeps no suggestion when the Lead names a workflow outside the list', async () => {
    const world = await guidedWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'fix the flaky export test' });

    await autoTurnEndsWithBlock({ world, block: { ...holdBlock, suggest: 'Cook dinner' } });

    expect((await guideOf(world)).holdSuggestion).toBeNull();
  });

  it('reads as needs you on the Lead, with the reason', async () => {
    const world = await heldWorld();

    const [view] = await readAutoTreeViews({
      db: world.state.world.db,
      sessionId: AUTO_SEED_SESSION,
    });

    expect(view?.hold).toEqual({
      reason: "It works as designed, so this isn't a bug.",
      suggestion: 'Plan and ship',
      suggestionId: SHIP,
    });
    expect(view === undefined ? null : autoTreeWordOf({ view, rootTurn: null }).state).toBe(
      'asking',
    );
  });

  it('refuses all new work, readers too, until the user answers', async () => {
    const world = await heldWorld();
    await addUserRow({ world: world.state.world, id: 'outbox-user-2', text: 'what now' });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    const scout = await autoDelegates({ world, spec: SCOUT });
    const writer = await autoDelegates({ world, spec: IMPLEMENT, requestId: 'request-2' });

    expect(scout.code).toBe('held');
    expect(writer.code).toBe('held');
  });

  it('lifts on any answer and reads as Continue', async () => {
    const world = await heldWorld();

    const outcome = await submitUserMessage({
      ctx: world.runtime.ctx,
      treeId: world.treeId,
      text: 'carry on as a bug fix',
    });

    expect(outcome.kind).toBe('queued');
    expect((await guideOf(world)).check).toBe('continued');
    const [view] = await readAutoTreeViews({
      db: world.state.world.db,
      sessionId: AUTO_SEED_SESSION,
    });
    expect(view?.hold).toBeNull();
  });

  it('does not lift a record that is not held', async () => {
    const world = await guidedWorld();
    await ensureRunGuide({ db: world.state.world.db, treeId: world.treeId });

    await submitUserMessage({ ctx: world.runtime.ctx, treeId: world.treeId, text: 'hello' });

    expect((await guideOf(world)).check).toBe('pending');
  });

  it('refuses a second report after a hold and tells the Lead why', async () => {
    const world = await heldWorld();
    await addUserRow({ world: world.state.world, id: 'outbox-user-2', text: 'what now' });
    await world.runtime.drive(world.treeId);
    await world.runtime.settled();

    await autoTurnEndsWithBlock({ world, block: { action: 'follow', check: 'Looks fine.' } });

    expect((await guideOf(world)).check).toBe('held');
    expect((await refusalsOf(world)).map((payload) => payload.code)).toContain('held');
  });
});

describe('a block of a run that follows no workflow', () => {
  it('is refused with a sentence and changes nothing', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    await userSays({ world, id: 'outbox-user-1', text: 'explain the ledger export' });

    await autoTurnEndsWithBlock({ world, block: { action: 'follow', check: 'Done.' } });

    expect(await readRunGuideRaw({ db: world.state.world.db, treeId: world.treeId })).toBeNull();
    const [refusal] = await refusalsOf(world);
    expect(refusal?.code).toBe('spec_invalid');
    expect(refusal?.text).toContain('follows no workflow');
  });
});

describe('the record of a run with no check', () => {
  it('starts passed so no writer waits', () => {
    const guide = startGuideRecord({
      workflowId: 'wf-harborline-release',
      name: 'Harborline release',
      entryCheck: '',
      stopRule: '',
      suggestion: null,
      isOrderKept: false,
      steps: [],
      choices: [],
      isUnderway: false,
    });

    expect(guide.check).toBe('passed');
  });
});
