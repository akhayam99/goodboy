import { describe, expect, it } from 'vitest';
import { listAutoDelegations, setSetting } from '@goodboy/db';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { SETTING_WORK_ENABLED } from '../../../../shared/lib/workSetting';
import { writeLeadPermission, type LeadPermissionChange } from '../level/writeLeadPermission';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  planRef,
  registerPlan,
  WORLD_NOW,
  WORLD_TREE,
  type AutoWorld,
} from '../testing/autoWorld';

const WORKSPACE = { workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }) };

type RowParams = {
  readonly world: AutoWorld;
  readonly change: LeadPermissionChange;
};

const setLeadRow = ({ world, change }: RowParams): Promise<void> =>
  writeLeadPermission({ db: world.db, target: { treeId: WORLD_TREE }, change, nowMs: WORLD_NOW });

type AdmitParams = {
  readonly world: AutoWorld;
  readonly role: 'scout' | 'implementer';
  readonly hasPlan: boolean;
};

const admitOne = async ({ world, role, hasPlan }: AdmitParams) => {
  const outcome = await world.scheduler.admit(
    batchInput({
      children: [
        childInput({
          key: role,
          role,
          inputArtifacts: hasPlan ? [planRef({ id: 'plan-acme', revision: 1 })] : [],
        }),
      ],
    }),
  );
  const rows = await listAutoDelegations({ db: world.db, treeId: WORLD_TREE });
  return {
    kind: outcome.kind === 'refused' ? outcome.code : outcome.kind,
    state: rows[0]?.state ?? null,
  };
};

const planWorld = async (): Promise<AutoWorld> => {
  const world = await makeAutoWorld({
    agentIds: ['agent-planner'],
    planIds: [{ id: 'plan-acme', agentId: 'agent-planner' }],
  });
  await registerPlan({ world, id: 'plan-acme', agentId: 'agent-planner' });
  return world;
};

describe('admission reads the permission rows', () => {
  it.each([
    ['ask', 'awaiting_confirm'],
    ['free', 'accepted'],
  ] as const)('starts a reader with Start agents that read %s as %s', async (value, state) => {
    const world = await makeAutoWorld();
    await setLeadRow({ world, change: { key: 'startReaders', value } });
    expect(await admitOne({ world, role: 'scout', hasPlan: false })).toEqual({
      kind: 'accepted',
      state,
    });
  });

  it.each([
    ['ask', 'awaiting_confirm'],
    ['afterPlan', 'accepted'],
    ['free', 'accepted'],
  ] as const)('starts a writer with Start agents that write %s as %s', async (value, state) => {
    const world = await makeAutoWorld();
    await setLeadRow({ world, change: { key: 'startWriters', value } });
    expect(await admitOne({ world, role: 'implementer', hasPlan: false })).toEqual({
      kind: 'accepted',
      state,
    });
  });

  it.each([
    ['ask', { kind: 'artifact_unapproved', state: null }],
    ['skip', { kind: 'accepted', state: 'awaiting_confirm' }],
  ] as const)(
    'gates a writer on an unapproved plan with Approve the plan %s',
    async (value, expected) => {
      const world = await planWorld();
      await setLeadRow({ world, change: { key: 'approvePlan', value } });
      expect(await admitOne({ world, role: 'implementer', hasPlan: true })).toEqual(expected);
    },
  );

  it('starts a writer at once with Approve the plan skip and writers free', async () => {
    const world = await planWorld();
    await setLeadRow({ world, change: { key: 'approvePlan', value: 'skip' } });
    await setLeadRow({ world, change: { key: 'startWriters', value: 'free' } });
    expect(await admitOne({ world, role: 'implementer', hasPlan: true })).toEqual({
      kind: 'accepted',
      state: 'accepted',
    });
  });

  it.each([
    [true, 'awaiting_confirm'],
    [false, 'accepted'],
  ] as const)(
    'reads the workspace default only while the work switch is on (%s)',
    async (isOn, state) => {
      const world = await makeAutoWorld();
      await setSetting(world.db, SETTING_WORK_ENABLED, isOn ? 'true' : 'false');
      await writeLeadPermission({
        db: world.db,
        target: WORKSPACE,
        change: { key: 'startReaders', value: 'ask' },
        nowMs: WORLD_NOW,
      });
      expect(await admitOne({ world, role: 'scout', hasPlan: false })).toEqual({
        kind: 'accepted',
        state,
      });
    },
  );
});
