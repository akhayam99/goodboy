import { describe, expect, it } from 'vitest';
import type { IsoDateTime, StepId, WorkflowId, WorkspaceId } from '@goodboy/types';
import {
  deleteWorkflow,
  getWorkflow,
  insertWorkspace,
  listWorkflows,
  migrate,
  upsertWorkflow,
  type Database as DbInterface,
} from '@goodboy/db';
import { WORKFLOW_LIBRARY } from './library';
import { restoreWorkflowLibrary, seedMissingBuiltinWorkflows, seedWorkflowLibrary } from './seeder';
import { PROVIDER_CAPABILITIES } from '../providers/capabilities';
import { makeTestDatabase } from '@goodboy/db/test-helpers';

const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

const makeDb = (): DbInterface => makeTestDatabase();

async function setup() {
  const db = makeDb();
  await migrate(db);
  const workspaceId = 'ws_seed_test' as WorkspaceId;
  await insertWorkspace({
    db,
    workspace: {
      id: workspaceId,
      name: 'seed-test',
      slug: 'seed-test',
      overrides: {
        defaultProviderId: null,
        defaultWorkflowId: null,
        defaultBranchPrefix: null,
        parallelEnabled: null,
        defaultVerbosity: null,
        providerBindings: null,
        taskModels: null,
        roleModels: null,
        parallelAgents: null,
        providerPool: null,
        attributionFooter: null,
        replyVoice: null,
        replyStyleNote: null,
        replyTemplateFixed: null,
        replyTemplateNoChange: null,
        resolveOnGithub: null,
        resolveCommitStyle: null,
      },
      createdAt: now(),
      updatedAt: now(),
    },
  });
  return { db, workspaceId };
}

describe('seedWorkflowLibrary', () => {
  it('seeds all library entries with deterministic ids', async () => {
    const { db, workspaceId } = await setup();
    const result = await seedWorkflowLibrary({ db }, workspaceId);

    expect(result.seeded).toHaveLength(WORKFLOW_LIBRARY.length);
    for (const entry of WORKFLOW_LIBRARY) {
      const seeded = result.seeded.find((s) => s.slug === entry.slug);
      expect(seeded).toBeDefined();
      expect(seeded!.workflowId).toBe(`wf_seed_${entry.slug}_${workspaceId}`);
    }
  });

  it('persists each entry with its steps in the right order', async () => {
    const { db, workspaceId } = await setup();
    await seedWorkflowLibrary({ db }, workspaceId);

    const workflows = await listWorkflows(db, workspaceId);
    expect(workflows).toHaveLength(WORKFLOW_LIBRARY.length);

    for (const entry of WORKFLOW_LIBRARY) {
      const wf = workflows.find((w) => w.name === entry.name);
      expect(wf).toBeDefined();
      expect(wf!.steps).toHaveLength(entry.steps.length);
      entry.steps.forEach((s, i) => {
        expect(wf!.steps[i]!.name).toBe(s.name);
        expect(wf!.steps[i]!.ordinal).toBe(i);
        expect(wf!.steps[i]!.promptPrefix).toBe(s.promptPrefix);
        expect(wf!.steps[i]!.expectedOutput).toBe(s.expectedOutput);
      });
    }
  });

  it('is idempotent: re-seeding does not duplicate', async () => {
    const { db, workspaceId } = await setup();
    await seedWorkflowLibrary({ db }, workspaceId);
    await seedWorkflowLibrary({ db }, workspaceId);

    const workflows = await listWorkflows(db, workspaceId);
    expect(workflows).toHaveLength(WORKFLOW_LIBRARY.length);
  });

  it('uses the injected now() if provided', async () => {
    const { db, workspaceId } = await setup();
    const fixed = '2026-05-09T12:00:00.000Z' as IsoDateTime;
    await seedWorkflowLibrary({ db, now: () => fixed }, workspaceId);

    const workflows = await listWorkflows(db, workspaceId);
    for (const wf of workflows) {
      expect(wf.createdAt).toBe(fixed);
      expect(wf.updatedAt).toBe(fixed);
    }
  });

  it('ships refactor, plan and ship, and fix a bug as built-ins', () => {
    expect(WORKFLOW_LIBRARY.map((entry) => entry.name)).toEqual([
      'Refactor',
      'Plan and ship',
      'Fix a bug',
    ]);
  });

  describe('seedMissingBuiltinWorkflows', () => {
    const upgradedWorkspace = async () => {
      const { db, workspaceId } = await setup();
      await seedWorkflowLibrary({ db }, workspaceId);
      for (const slug of ['plan-and-ship', 'fix-a-bug']) {
        await db.execute('DELETE FROM steps WHERE workflow_id = ?', [
          `wf_seed_${slug}_${workspaceId}`,
        ]);
        await db.execute('DELETE FROM workflows WHERE id = ?', [`wf_seed_${slug}_${workspaceId}`]);
      }
      return { db, workspaceId };
    };

    it('adds the built-ins an upgraded workspace never had', async () => {
      const { db, workspaceId } = await upgradedWorkspace();

      const result = await seedMissingBuiltinWorkflows({ db });

      expect(result.seeded.map((seeded) => seeded.workflowId)).toEqual([
        `wf_seed_plan-and-ship_${workspaceId}`,
        `wf_seed_fix-a-bug_${workspaceId}`,
      ]);
      const names = (await listWorkflows(db, workspaceId)).map((workflow) => workflow.name);
      expect(names).toEqual(['Refactor', 'Plan and ship', 'Fix a bug']);
    });

    it('does nothing on a second run and never brings back a built-in the user removed', async () => {
      const { db, workspaceId } = await upgradedWorkspace();
      await seedMissingBuiltinWorkflows({ db });
      await deleteWorkflow(db, `wf_seed_fix-a-bug_${workspaceId}` as WorkflowId);

      const again = await seedMissingBuiltinWorkflows({ db });

      expect(again.seeded).toEqual([]);
      const names = (await listWorkflows(db, workspaceId)).map((workflow) => workflow.name);
      expect(names).toEqual(['Refactor', 'Plan and ship']);
    });

    it('skips a built-in whose name the user already holds', async () => {
      const { db, workspaceId } = await upgradedWorkspace();
      await upsertWorkflow(db, {
        id: 'wf-own-fix' as WorkflowId,
        workspaceId,
        name: 'Fix a bug',
        description: '',
        steps: [],
        origin: 'custom',
        createdAt: now(),
        updatedAt: now(),
      });

      const result = await seedMissingBuiltinWorkflows({ db });

      expect(result.seeded.map((seeded) => seeded.workflowId)).toEqual([
        `wf_seed_plan-and-ship_${workspaceId}`,
      ]);
      expect(await getWorkflow(db, `wf_seed_fix-a-bug_${workspaceId}` as WorkflowId)).toBeNull();
    });
  });

  describe('restoreWorkflowLibrary', () => {
    const REFACTOR = 'refactor-example';
    const FIX = 'fix-a-bug';

    it('puts back the steps of an edited built-in and drops the steps the user added', async () => {
      const { db, workspaceId } = await setup();
      await seedWorkflowLibrary({ db }, workspaceId);
      const workflowId = `wf_seed_${REFACTOR}_${workspaceId}` as WorkflowId;
      const seeded = await getWorkflow(db, workflowId);
      const [first, ...rest] = seeded!.steps;
      await upsertWorkflow(db, {
        ...seeded!,
        name: 'Refactor ledger-core',
        steps: [
          { ...first!, promptPrefix: 'Map it.', modelOverride: 'model-x' },
          ...rest,
          { ...first!, id: 'step-extra' as StepId, ordinal: rest.length + 1 },
        ],
      });

      await restoreWorkflowLibrary({ db }, { workspaceId, slugs: [REFACTOR] });

      const restored = await getWorkflow(db, workflowId);
      const entry = WORKFLOW_LIBRARY.find((candidate) => candidate.slug === REFACTOR)!;
      expect(restored!.name).toBe(entry.name);
      expect(restored!.steps.map((step) => step.promptPrefix)).toEqual(
        entry.steps.map((step) => step.promptPrefix),
      );
      expect(restored!.steps.some((step) => step.modelOverride !== undefined)).toBe(false);
    });

    it('brings back a deleted built-in and leaves the others alone', async () => {
      const { db, workspaceId } = await setup();
      await seedWorkflowLibrary({ db }, workspaceId);
      await deleteWorkflow(db, `wf_seed_${FIX}_${workspaceId}` as WorkflowId);
      const refactorId = `wf_seed_${REFACTOR}_${workspaceId}` as WorkflowId;
      const refactor = await getWorkflow(db, refactorId);
      await upsertWorkflow(db, { ...refactor!, name: 'Refactor ledger-core' });

      const result = await restoreWorkflowLibrary({ db }, { workspaceId, slugs: [FIX] });

      expect(result.seeded.map((seeded) => seeded.slug)).toEqual([FIX]);
      const names = (await listWorkflows(db, workspaceId)).map((workflow) => workflow.name);
      expect(names).toContain('Fix a bug');
      expect(names).toContain('Refactor ledger-core');
    });
  });

  describe('provider routing (regression for cursor/codex sessions)', () => {
    it('does not hardcode providerOverride on seeded steps', async () => {
      const { db, workspaceId } = await setup();
      await seedWorkflowLibrary({ db }, workspaceId);

      const workflows = await listWorkflows(db, workspaceId);
      const steps = workflows.flatMap((w) => w.steps);

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.every((s) => s.providerOverride === undefined)).toBe(true);
    });

    it('does not pin anthropic model IDs on seeded steps', async () => {
      const { db, workspaceId } = await setup();
      await seedWorkflowLibrary({ db }, workspaceId);

      const workflows = await listWorkflows(db, workspaceId);
      const steps = workflows.flatMap((w) => w.steps);

      const anthropicModelIds = new Set(PROVIDER_CAPABILITIES.anthropic.models.map((m) => m.id));

      const stepsWithAnthropicModelId = steps.filter(
        (s) => s.modelOverride !== undefined && anthropicModelIds.has(s.modelOverride),
      );

      expect(stepsWithAnthropicModelId).toHaveLength(0);
    });
  });
});
