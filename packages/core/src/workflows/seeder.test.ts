import { describe, expect, it } from 'vitest';
import type { IsoDateTime, StepId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import {
  deleteWorkflow,
  getWorkflow,
  insertWorkspace,
  listWorkflows,
  upsertWorkflow,
  type Database as DbInterface,
} from '@goodboy/db';
import { migrate } from '@goodboy/db/migrations';
import { WORKFLOW_LIBRARY } from './library';
import {
  restoreWorkflowLibrary,
  seedMissingBuiltinWorkflows,
  seedWorkflowLibrary,
  WorkflowRestoreError,
} from './seeder';
import { PROVIDER_CAPABILITIES } from '../providers/capabilities';
import { normalizeAgentRole } from '../roles';
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
        defaultBranchPrefix: null,
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
        afterMerge: null,
        defaultBranchTemplate: null,
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

    type LegacyRefactorParams = {
      readonly db: DbInterface;
      readonly workspaceId: WorkspaceId;
    };

    const legacyRefactor = async ({ db, workspaceId }: LegacyRefactorParams): Promise<Workflow> => {
      const entry = WORKFLOW_LIBRARY.find((candidate) => candidate.slug === REFACTOR);
      if (entry === undefined) {
        throw new Error('Refactor is missing from the workflow library');
      }
      const workflowId = `wf_seed_${REFACTOR}_legacy-container` as WorkflowId;
      const workflow: Workflow = {
        id: workflowId,
        workspaceId,
        name: 'Refactor ledger-core',
        description: 'Edited before workspace containers',
        origin: 'library',
        isPreset: true,
        steps: entry.steps.map((step, ordinal) => ({
          id: `step_seed_${REFACTOR}_${ordinal}_legacy-container` as StepId,
          workflowId,
          role: normalizeAgentRole({ role: step.role }),
          ordinal,
          name: step.name,
          promptPrefix: ordinal === 0 ? 'Map it differently.' : step.promptPrefix,
          expectedOutput: step.expectedOutput,
        })),
        createdAt: now(),
        updatedAt: now(),
      };
      await upsertWorkflow(db, workflow);
      return workflow;
    };

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

    it('restores a legacy-suffix row without adding another row and keeps step ids', async () => {
      const { db, workspaceId } = await setup();
      const legacy = await legacyRefactor({ db, workspaceId });

      const result = await restoreWorkflowLibrary({ db }, { workspaceId, slugs: [REFACTOR] });

      const workflows = await listWorkflows(db, workspaceId);
      expect(result.seeded).toEqual([{ slug: REFACTOR, workflowId: legacy.id }]);
      expect(workflows).toHaveLength(1);
      expect(workflows[0]?.id).toBe(legacy.id);
      expect(workflows[0]?.steps.map((step) => step.id)).toEqual(
        legacy.steps.map((step) => step.id),
      );
    });

    it('returns name_taken without writing when another workflow holds the name', async () => {
      const { db, workspaceId } = await setup();
      await upsertWorkflow(db, {
        id: 'wf-own-refactor' as WorkflowId,
        workspaceId,
        name: 'Refactor',
        description: 'Custom refactor workflow',
        origin: 'custom',
        isPreset: true,
        steps: [],
        createdAt: now(),
        updatedAt: now(),
      });

      const failure = await restoreWorkflowLibrary({ db }, { workspaceId, slugs: [REFACTOR] }).then(
        () => null,
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(WorkflowRestoreError);
      expect(failure).toMatchObject({
        kind: 'name_taken',
        message: 'A workflow named Refactor already exists. Rename it and try again.',
      });
      expect(await listWorkflows(db, workspaceId)).toHaveLength(1);
    });

    it('refuses a restore while that workflow has a live run', async () => {
      const { db, workspaceId } = await setup();
      const legacy = await legacyRefactor({ db, workspaceId });
      await db.execute(
        "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session-live', ?, 'Northwind checkout', 'running', 1, 1)",
        [workspaceId],
      );
      await db.execute(
        "INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at) VALUES ('run-live', 'session-live', ?, 0, 0, 1)",
        [legacy.id],
      );

      const failure = await restoreWorkflowLibrary({ db }, { workspaceId, slugs: [REFACTOR] }).then(
        () => null,
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(WorkflowRestoreError);
      expect(failure).toMatchObject({
        kind: 'workflow_running',
        message: 'Refactor is running in Northwind checkout. Restore it when the run ends.',
      });
      expect((await getWorkflow(db, legacy.id))?.name).toBe('Refactor ledger-core');
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
