import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import type { Database } from '../client';
import {
  attachWorkflowToSession,
  deleteOrphanedWorkflowAgents,
  detachWorkflowFromSession,
  discardWorkflowInSession,
  restoreWorkflowInSession,
  repointWorkflowRunTemplate,
  updateSessionWorkflowTriggerMode,
  updateWorkflowOrder,
  updateWorkflowRunOrchestrationOutcome,
  updateWorkflowRunOrchestrationStop,
  updateWorkflowRunOrchestratorRouting,
  updateWorkflowRunSpendLimit,
  updateGeneratedWorkflowRunTitle,
  updateUserWorkflowRunTitle,
} from './session-workflow';
import { getSessionById, listSessionsForWorkspace } from './session';

const workspaceId = 'ws-1' as WorkspaceId;
const sessionId = 'ses-1' as SessionId;
const workflowId = 'wf-1' as WorkflowId;
const workflowId2 = 'wf-2' as WorkflowId;
const NOW = '2026-06-12T00:00:00.000Z' as IsoDateTime;

type InsertActivePlanParams = {
  readonly db: Database;
  readonly workflowRunId: WorkflowRunId;
};

const insertActivePlan = async ({ db, workflowRunId }: InsertActivePlanParams): Promise<void> => {
  await db.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id) VALUES (?, ?, ?, ?, ?, ?)',
    ['planner-1', sessionId, 0, 'Planner', 'completed', workflowRunId],
  );
  await db.execute(
    `INSERT INTO session_artifacts (
       id, session_id, agent_id, workflow_run_id, kind, schema_version, title, source_format,
       source_text, metadata_json, status, revision, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'plan', 1, ?, 'markdown', ?, '{}', 'active', 1, ?, ?)`,
    [
      'plan-1',
      sessionId,
      'planner-1',
      workflowRunId,
      'Plan',
      'Body',
      Date.parse(NOW),
      Date.parse(NOW),
    ],
  );
};

type ReadRunsParams = {
  readonly db: Database;
};

const readRunsNewestFirst = async ({ db }: ReadRunsParams): Promise<ReadonlyArray<WorkflowRun>> => {
  const session = await getSessionById(db, sessionId);
  return [...(session?.workflowRuns ?? [])].reverse();
};

type ReadPlanStatusParams = {
  readonly db: Database;
};

const readPlanStatus = async ({ db }: ReadPlanStatusParams): Promise<string> => {
  const rows = await db.select<{ readonly status: string }>(
    "SELECT status FROM session_artifacts WHERE id = 'plan-1'",
  );
  return rows[0]?.status ?? '';
};

async function seed(): Promise<Database> {
  const db = await makeMigratedTestDatabase();
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [workflowId, workspaceId, 'Workflow 1', '', now, now],
  );
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [workflowId2, workspaceId, 'Workflow 2', '', now, now],
  );
  return db;
}

describe('session_workflows trigger-mode queries', () => {
  let db: Database;

  beforeEach(async () => {
    db = await seed();
  });

  describe('repointWorkflowRunTemplate', () => {
    it('moves the run onto a cloned template and carries its agents to the clone steps', async () => {
      const runId = 'run-1' as WorkflowRunId;
      await db.execute(
        'INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix) VALUES (?, ?, ?, ?, ?)',
        ['step-1', workflowId, 0, 'Scout', ''],
      );
      await db.execute(
        'INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix) VALUES (?, ?, ?, ?, ?)',
        ['clone-step-1', workflowId2, 0, 'Scout', ''],
      );
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: runId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await db.execute(
        'INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id, step_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['agent-1', sessionId, 0, 'Scout', 'completed', runId, 'step-1'],
      );

      await repointWorkflowRunTemplate({
        db,
        workflowRunId: runId,
        workflowId: workflowId2,
        stepRepoints: [{ fromStepId: 'step-1' as StepId, toStepId: 'clone-step-1' as StepId }],
      });

      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.workflowId).toBe(workflowId2);
      const agents = await db.select<{ readonly step_id: string }>(
        'SELECT step_id FROM agents WHERE id = ?',
        ['agent-1'],
      );
      expect(agents[0]!.step_id).toBe('clone-step-1');
    });
  });

  describe('attachWorkflowToSession + toWorkflowRun mapping', () => {
    it('defaults trigger_mode to immediate and omits chainAfterId when none given', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      const runs = await readRunsNewestFirst({ db });
      expect(runs).toHaveLength(1);
      expect(runs[0]!.triggerMode).toBe('immediate');
      expect(runs[0]!.chainAfterId).toBeUndefined();
      expect(runs[0]!.autoRun).toBe(true);
    });

    it('persists manual trigger mode', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
        triggerMode: 'manual',
      });
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.triggerMode).toBe('manual');
      expect(runs[0]!.autoRun).toBe(false);
    });

    it('persists dynamic execution mode', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
      });
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.executionMode).toBe('dynamic');
    });

    it('persists the orchestrator routing chosen at launch', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
        executionMode: 'dynamic',
        orchestratorRouting: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
      });

      const runs = await readRunsNewestFirst({ db });

      expect(runs[0]!.orchestratorRouting).toEqual({
        providerId: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'high',
      });
    });

    it('leaves the orchestrator routing unset when launch did not override it', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
        executionMode: 'dynamic',
      });

      const runs = await readRunsNewestFirst({ db });

      expect(runs[0]!.orchestratorRouting).toBeUndefined();
    });

    it('persists after_run mode with chain_after_run_id round-trip', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'pred' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'chained' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
        triggerMode: 'after_run',
        chainAfterRunId: 'pred' as WorkflowRunId,
      });
      const runs = await readRunsNewestFirst({ db });
      const chained = runs.find((r) => r.id === ('chained' as WorkflowRunId));
      expect(chained!.triggerMode).toBe('after_run');
      expect(chained!.chainAfterId).toBe('pred');
    });

    it('auto-increments ordinal across attaches', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'r0' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'r1' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
      });
      const runs = await readRunsNewestFirst({ db });
      expect(runs.map((r) => [r.id, r.ordinal])).toEqual([
        ['r1', 1],
        ['r0', 0],
      ]);
    });
  });

  describe('createdAt mapping', () => {
    const hostZone = process.env['TZ'];

    beforeAll(() => {
      process.env['TZ'] = 'America/New_York';
    });

    afterAll(() => {
      if (hostZone == null) {
        delete process.env['TZ'];
        return;
      }
      process.env['TZ'] = hostZone;
    });

    it('reads the SQLite datetime text as UTC, not as host local time', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'r0' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await db.execute('UPDATE session_workflows SET created_at = ? WHERE workflow_run_id = ?', [
        '2026-08-05 09:14:22',
        'r0',
      ]);
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.createdAt).toBe('2026-08-05T09:14:22.000Z');
    });

    it('omits createdAt when the column is empty', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'r0' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await db.execute('UPDATE session_workflows SET created_at = ? WHERE workflow_run_id = ?', [
        '',
        'r0',
      ]);
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.createdAt).toBeUndefined();
    });

    it('keeps the attach timestamp across a reorder', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'r0' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'r1' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
      });
      await db.execute('UPDATE session_workflows SET created_at = ? WHERE workflow_run_id = ?', [
        '2026-08-05 09:14:22',
        'r0',
      ]);
      await updateWorkflowOrder(db, sessionId, ['r1' as WorkflowRunId, 'r0' as WorkflowRunId], NOW);
      const runs = await readRunsNewestFirst({ db });
      expect(runs.find((r) => r.id === ('r0' as WorkflowRunId))!.createdAt).toBe(
        '2026-08-05T09:14:22.000Z',
      );
    });
  });

  describe('updateSessionWorkflowTriggerMode', () => {
    it('flips an after_run run to immediate', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'pred' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        triggerMode: 'after_run',
        chainAfterRunId: 'pred' as WorkflowRunId,
      });
      await updateSessionWorkflowTriggerMode(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        'immediate',
        NOW,
      );
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.triggerMode).toBe('immediate');
    });

    it('flips a chained run to manual without clearing chain_after_run_id', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'pred' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        triggerMode: 'after_run',
        chainAfterRunId: 'pred' as WorkflowRunId,
      });
      await updateSessionWorkflowTriggerMode(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        'manual',
        NOW,
      );
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.triggerMode).toBe('manual');
      expect(runs[0]!.chainAfterId).toBe('pred');
    });
  });

  describe('updateWorkflowOrder preserves chain metadata', () => {
    it('keeps trigger_mode and chain_after_run_id after reorder', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'pred' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'chained' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: false,
        updatedAt: NOW,
        triggerMode: 'after_run',
        chainAfterRunId: 'pred' as WorkflowRunId,
      });
      await updateWorkflowOrder(
        db,
        sessionId,
        ['chained' as WorkflowRunId, 'pred' as WorkflowRunId],
        NOW,
      );
      const runs = await readRunsNewestFirst({ db });
      expect(runs.map((r) => [r.id, r.ordinal])).toEqual([
        ['pred', 1],
        ['chained', 0],
      ]);
      const chained = runs.find((r) => r.id === ('chained' as WorkflowRunId));
      expect(chained!.triggerMode).toBe('after_run');
      expect(chained!.chainAfterId).toBe('pred');
      expect(chained!.autoRun).toBe(false);
    });
  });

  describe('per-run spend limit', () => {
    it('leaves a fresh run uncapped and pausing', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      const run = (await readRunsNewestFirst({ db }))[0]!;
      expect(run.spendLimitUsd).toBeUndefined();
      expect(run.spendLimitMode).toBe('pause');
    });

    it('round-trips the limit set on the run and clears it', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await updateWorkflowRunSpendLimit(db, 'run-1' as WorkflowRunId, 7.5, 'notify');
      const capped = (await readRunsNewestFirst({ db }))[0]!;
      expect(capped.spendLimitUsd).toBe(7.5);
      expect(capped.spendLimitMode).toBe('notify');

      await updateWorkflowRunSpendLimit(db, 'run-1' as WorkflowRunId, null, 'pause');
      const uncapped = (await readRunsNewestFirst({ db }))[0]!;
      expect(uncapped.spendLimitUsd).toBeUndefined();
      expect(uncapped.spendLimitMode).toBe('pause');
    });

    it('keeps the limit when runs are reordered', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-2' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
      });
      await updateWorkflowRunSpendLimit(db, 'run-1' as WorkflowRunId, 12.5, 'notify');
      await updateWorkflowOrder(
        db,
        sessionId,
        ['run-2' as WorkflowRunId, 'run-1' as WorkflowRunId],
        NOW,
      );
      const run = (await readRunsNewestFirst({ db })).find(
        (candidate) => candidate.id === ('run-1' as WorkflowRunId),
      )!;
      expect(run.spendLimitUsd).toBe(12.5);
      expect(run.spendLimitMode).toBe('notify');
    });
  });

  describe('per-run provider pool', () => {
    it('leaves a run without a pool free to use every provider', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        executionMode: 'dynamic',
      });
      const run = (await readRunsNewestFirst({ db }))[0]!;
      expect(run.providerPool).toBeUndefined();
    });

    it('round-trips the providers picked in the builder', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        executionMode: 'dynamic',
        providerPool: ['codex', 'anthropic'],
      });
      const run = (await readRunsNewestFirst({ db }))[0]!;
      expect(run.providerPool).toEqual(['anthropic', 'codex']);
    });

    it('drops unknown providers from a stored pool', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        executionMode: 'dynamic',
      });
      await db.execute(
        'UPDATE session_workflows SET provider_pool = \'["retired","codex"]\' WHERE workflow_run_id = \'run-1\'',
      );
      const run = (await readRunsNewestFirst({ db }))[0]!;
      expect(run.providerPool).toEqual(['codex']);
    });
  });

  describe('per-run goal', () => {
    it('round-trips the goal typed in the builder', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
        goal: 'just the auth module',
      });
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.goal).toBe('just the auth module');
    });

    it('omits the goal when none was typed', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
      });
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.goal).toBeUndefined();
    });

    it('keeps the goal when runs are reordered', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
        goal: 'first goal',
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-2' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: false,
        updatedAt: NOW,
        goal: 'second goal',
      });
      await updateWorkflowOrder(
        db,
        sessionId,
        ['run-2' as WorkflowRunId, 'run-1' as WorkflowRunId],
        NOW,
      );
      const runs = await readRunsNewestFirst({ db });
      expect(runs.map((r) => [r.id, r.goal])).toEqual([
        ['run-1', 'first goal'],
        ['run-2', 'second goal'],
      ]);
    });
  });

  describe('run title', () => {
    const attachRun = () =>
      attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
        goal: 'fix the login redirect loop',
      });

    it('starts without a title', async () => {
      await attachRun();
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.title).toBeUndefined();
      expect(runs[0]!.titleUserEdited).toBeUndefined();
    });

    it('stores a generated title while the user has not named the run', async () => {
      await attachRun();
      const isWritten = await updateGeneratedWorkflowRunTitle({
        db,
        workflowRunId: 'run-1' as WorkflowRunId,
        title: 'Fix login redirect loop',
      });
      const runs = await readRunsNewestFirst({ db });
      expect(isWritten).toBe(true);
      expect(runs[0]!.title).toBe('Fix login redirect loop');
      expect(runs[0]!.titleUserEdited).toBeUndefined();
    });

    it('keeps the name the user chose over a later generated title', async () => {
      await attachRun();
      await updateUserWorkflowRunTitle({
        db,
        workflowRunId: 'run-1' as WorkflowRunId,
        title: 'Login loop',
      });
      const isWritten = await updateGeneratedWorkflowRunTitle({
        db,
        workflowRunId: 'run-1' as WorkflowRunId,
        title: 'Fix login redirect loop',
      });
      const runs = await readRunsNewestFirst({ db });
      expect(isWritten).toBe(false);
      expect(runs[0]!.title).toBe('Login loop');
      expect(runs[0]!.titleUserEdited).toBe(true);
    });
  });

  describe('updateWorkflowRunOrchestrationOutcome', () => {
    it('attaches with a null outcome by default', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
      });
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.orchestrationOutcome).toBeUndefined();
    });

    it('round-trips done and blocked outcomes', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
      });
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, 'done');
      expect((await readRunsNewestFirst({ db }))[0]!.orchestrationOutcome).toBe('done');
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, 'blocked');
      expect((await readRunsNewestFirst({ db }))[0]!.orchestrationOutcome).toBe('blocked');
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, null);
      expect((await readRunsNewestFirst({ db }))[0]!.orchestrationOutcome).toBeUndefined();
    });

    it('keeps the outcome when runs are reordered', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-2' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
      });
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, 'done');
      await updateWorkflowOrder(
        db,
        sessionId,
        ['run-2' as WorkflowRunId, 'run-1' as WorkflowRunId],
        NOW,
      );
      const runs = await readRunsNewestFirst({ db });
      const first = runs.find((r) => r.id === ('run-1' as WorkflowRunId));
      expect(first!.orchestrationOutcome).toBe('done');
    });
  });

  describe('updateWorkflowRunOrchestrationStop', () => {
    const attachRun = async (runId: string) =>
      attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: runId as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
      });

    it('round-trips why the run stopped, not only the sentence', async () => {
      await attachRun('run-1');
      await updateWorkflowRunOrchestrationStop(db, 'run-1' as WorkflowRunId, {
        kind: 'budget',
        message: 'the budget cap is reached, raise it in Budget to keep this run going',
      });
      expect((await readRunsNewestFirst({ db }))[0]!.orchestrationStop).toEqual({
        kind: 'budget',
        message: 'the budget cap is reached, raise it in Budget to keep this run going',
      });

      await updateWorkflowRunOrchestrationStop(db, 'run-1' as WorkflowRunId, {
        kind: 'failure',
        message: 'usage limit reached (anthropic/haiku-4.5)',
      });
      expect((await readRunsNewestFirst({ db }))[0]!.orchestrationStop).toEqual({
        kind: 'failure',
        message: 'usage limit reached (anthropic/haiku-4.5)',
      });

      await updateWorkflowRunOrchestrationStop(db, 'run-1' as WorkflowRunId, null);
      expect((await readRunsNewestFirst({ db }))[0]!.orchestrationStop).toBeUndefined();
    });

    it('keeps the budget stop a budget stop when runs are reordered', async () => {
      await attachRun('run-1');
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-2' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
      });
      await updateWorkflowRunOrchestrationStop(db, 'run-1' as WorkflowRunId, {
        kind: 'budget',
        message: 'the budget cap is reached, raise it in Budget to keep this run going',
      });
      await updateWorkflowOrder(
        db,
        sessionId,
        ['run-2' as WorkflowRunId, 'run-1' as WorkflowRunId],
        NOW,
      );
      const runs = await readRunsNewestFirst({ db });
      expect(runs.find((r) => r.id === ('run-1' as WorkflowRunId))!.orchestrationStop?.kind).toBe(
        'budget',
      );
    });
  });

  describe('orchestrator reason and routing', () => {
    const attachDynamic = async () =>
      attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
        triggerMode: 'immediate',
        executionMode: 'dynamic',
      });

    it('keeps the reason the orchestrator gave for ending the run', async () => {
      await attachDynamic();
      await updateWorkflowRunOrchestrationOutcome(
        db,
        'run-1' as WorkflowRunId,
        'done',
        'the fix and its test are in, the docs are left',
      );
      const run = (await readRunsNewestFirst({ db }))[0]!;
      expect(run.orchestrationReason).toBe('the fix and its test are in, the docs are left');
    });

    it('drops the reason when the run is reopened', async () => {
      await attachDynamic();
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, 'done', 'all set');
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, null);
      const run = (await readRunsNewestFirst({ db }))[0]!;
      expect(run.orchestrationReason).toBeUndefined();
    });

    it('round-trips the routing pinned on the run and clears it', async () => {
      await attachDynamic();
      await updateWorkflowRunOrchestratorRouting(db, 'run-1' as WorkflowRunId, {
        providerId: 'codex',
        model: 'gpt-5.6',
        effort: 'high',
      });
      expect((await readRunsNewestFirst({ db }))[0]!.orchestratorRouting).toEqual({
        providerId: 'codex',
        model: 'gpt-5.6',
        effort: 'high',
      });
      await updateWorkflowRunOrchestratorRouting(db, 'run-1' as WorkflowRunId, null);
      expect((await readRunsNewestFirst({ db }))[0]!.orchestratorRouting).toBeUndefined();
    });

    it('carries the reason and the routing through a reorder', async () => {
      await attachDynamic();
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-2' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
      });
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, 'done', 'all set');
      await updateWorkflowRunOrchestratorRouting(db, 'run-1' as WorkflowRunId, {
        providerId: 'codex',
        model: 'gpt-5.6',
      });
      await updateWorkflowOrder(
        db,
        sessionId,
        ['run-2' as WorkflowRunId, 'run-1' as WorkflowRunId],
        NOW,
      );
      const run = (await readRunsNewestFirst({ db })).find(
        (candidate) => candidate.id === ('run-1' as WorkflowRunId),
      )!;
      expect(run.orchestrationReason).toBe('all set');
      expect(run.orchestratorRouting).toEqual({ providerId: 'codex', model: 'gpt-5.6' });
    });
  });

  describe('discardWorkflowInSession', () => {
    it('sets discarded_at and maps it through', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await insertActivePlan({ db, workflowRunId: 'run-1' as WorkflowRunId });
      await discardWorkflowInSession(db, sessionId, 'run-1' as WorkflowRunId, NOW);
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.discardedAt).toBe(NOW);
      expect(await readPlanStatus({ db })).toBe('superseded');
    });
  });

  describe('restoreWorkflowInSession', () => {
    it('clears discarded_at again', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await insertActivePlan({ db, workflowRunId: 'run-1' as WorkflowRunId });
      await discardWorkflowInSession(db, sessionId, 'run-1' as WorkflowRunId, NOW);
      await restoreWorkflowInSession(db, sessionId, 'run-1' as WorkflowRunId, NOW);
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.discardedAt).toBeUndefined();
      expect(await readPlanStatus({ db })).toBe('active');
    });
  });

  describe('detachWorkflowFromSession', () => {
    type InsertAgentParams = {
      readonly id: string;
      readonly workflowRunId: string | null;
      readonly parentAgentId?: string;
    };

    const insertAgent = async ({ id, workflowRunId, parentAgentId }: InsertAgentParams) => {
      await db.execute(
        'INSERT INTO agents (id, session_id, ordinal, name, status, workflow_run_id, parent_agent_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, sessionId, 0, id, 'completed', workflowRunId, parentAgentId ?? null],
      );
    };

    const readDeletedAt = async (): Promise<Record<string, number | null>> => {
      const rows = await db.select<{ readonly id: string; readonly deleted_at: number | null }>(
        'SELECT id, deleted_at FROM agents ORDER BY id',
      );
      return Object.fromEntries(rows.map((row) => [row.id, row.deleted_at]));
    };

    const attachRun = async (runId: string) => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: runId as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
    };

    it('soft-deletes the run agents and their spawned children in the same transaction', async () => {
      await attachRun('run-1');
      await attachRun('run-2');
      await insertAgent({ id: 'step-agent', workflowRunId: 'run-1' });
      await insertAgent({ id: 'orchestrator-spawned', workflowRunId: 'run-1' });
      await insertAgent({ id: 'fanout-child', workflowRunId: null, parentAgentId: 'step-agent' });
      await insertAgent({
        id: 'nested-child',
        workflowRunId: null,
        parentAgentId: 'fanout-child',
      });
      await insertAgent({ id: 'other-run', workflowRunId: 'run-2' });
      await insertAgent({ id: 'standalone', workflowRunId: null });
      for (const [index, agentId] of [
        'step-agent',
        'orchestrator-spawned',
        'nested-child',
        'other-run',
        'standalone',
      ].entries()) {
        await db.execute(
          `INSERT INTO open_questions (id, session_id, text, status, created_at, created_by_agent_id)
           VALUES (?, ?, ?, 'open', ?, ?)`,
          [`q-${agentId}`, sessionId, `Question from ${agentId}?`, index, agentId],
        );
      }

      const removed = await detachWorkflowFromSession(db, sessionId, 'run-1' as WorkflowRunId, NOW);

      expect([...removed].sort()).toEqual([
        'Question from nested-child?',
        'Question from orchestrator-spawned?',
        'Question from step-agent?',
      ]);
      const questions = await db.select<{ readonly id: string }>(
        'SELECT id FROM open_questions ORDER BY id',
      );
      expect(questions.map((row) => row.id)).toEqual(['q-other-run', 'q-standalone']);

      expect(await readDeletedAt()).toEqual({
        'fanout-child': Date.parse(NOW),
        'nested-child': Date.parse(NOW),
        'orchestrator-spawned': Date.parse(NOW),
        'other-run': null,
        standalone: null,
        'step-agent': Date.parse(NOW),
      });
      const live = await db.select<{ readonly id: string }>(
        'SELECT id FROM live_agents ORDER BY id',
      );
      expect(live.map((row) => row.id)).toEqual(['other-run', 'standalone']);
      expect((await readRunsNewestFirst({ db })).map((run) => run.id)).toEqual(['run-2']);
    });

    it('keeps the first deletion time of an agent deleted before its run', async () => {
      await attachRun('run-1');
      await insertAgent({ id: 'step-agent', workflowRunId: 'run-1' });
      await insertAgent({ id: 'left-child', workflowRunId: null, parentAgentId: 'step-agent' });
      await db.execute("UPDATE agents SET deleted_at = 5 WHERE id = 'step-agent'");

      await detachWorkflowFromSession(db, sessionId, 'run-1' as WorkflowRunId, NOW);

      expect(await readDeletedAt()).toEqual({ 'left-child': Date.parse(NOW), 'step-agent': 5 });
    });

    it('soft-deletes the agents of runs pruned by a reorder', async () => {
      await attachRun('run-1');
      await attachRun('run-2');
      await insertAgent({ id: 'kept', workflowRunId: 'run-1' });
      await insertAgent({ id: 'pruned', workflowRunId: 'run-2' });
      await insertAgent({ id: 'pruned-child', workflowRunId: null, parentAgentId: 'pruned' });
      await db.execute(
        `INSERT INTO open_questions (id, session_id, text, status, created_at, created_by_agent_id)
         VALUES ('q-kept', ?, 'Keep?', 'open', 1, 'kept'), ('q-pruned', ?, 'Prune?', 'open', 2, 'pruned-child')`,
        [sessionId, sessionId],
      );

      expect(await updateWorkflowOrder(db, sessionId, ['run-1' as WorkflowRunId], NOW)).toEqual([
        'Prune?',
      ]);

      expect(await readDeletedAt()).toEqual({
        kept: null,
        pruned: Date.parse(NOW),
        'pruned-child': Date.parse(NOW),
      });
    });
  });

  describe('deleteOrphanedWorkflowAgents', () => {
    it('soft-deletes step agents whose run is gone, once', async () => {
      await db.execute(
        `INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix)
         VALUES ('step-live', ?, 0, 'Scout', ''), ('step-gone', ?, 0, 'Build', '')`,
        [workflowId, workflowId2],
      );
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-live' as WorkflowRunId,
        workflowId,
        autoRun: true,
        updatedAt: NOW,
      });
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-gone' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: true,
        updatedAt: NOW,
      });
      await db.execute(
        `INSERT INTO agents (id, session_id, ordinal, name, status, step_id, workflow_run_id, parent_agent_id)
         VALUES
           ('orphan', ?, 0, 'orphan', 'completed', 'step-gone', 'run-gone', NULL),
           ('orphan-child', ?, 1, 'child', 'completed', NULL, NULL, 'orphan'),
           ('live', ?, 2, 'live', 'completed', 'step-live', 'run-live', NULL),
           ('same-workflow', ?, 3, 'same', 'completed', 'step-live', NULL, NULL),
           ('standalone', ?, 4, 'standalone', 'completed', NULL, NULL, NULL)`,
        [sessionId, sessionId, sessionId, sessionId, sessionId],
      );
      await db.execute(
        `INSERT INTO open_questions (id, session_id, text, status, created_at, created_by_agent_id)
         VALUES
           ('q-orphan', ?, 'Which cache?', 'open', 1, 'orphan'),
           ('q-child', ?, 'Which port?', 'open', 2, 'orphan-child'),
           ('q-answered', ?, 'Which branch?', 'answered', 3, 'orphan'),
           ('q-live', ?, 'Which region?', 'open', 4, 'live')`,
        [sessionId, sessionId, sessionId, sessionId],
      );
      await db.execute("DELETE FROM session_workflows WHERE workflow_run_id = 'run-gone'");

      const first = await deleteOrphanedWorkflowAgents({ db, now: 42 });
      expect(first.agentsDeleted).toBe(2);
      expect([...first.removedQuestions].sort((a, b) => a.text.localeCompare(b.text))).toEqual([
        { sessionId, text: 'Which cache?' },
        { sessionId, text: 'Which port?' },
      ]);
      expect(await deleteOrphanedWorkflowAgents({ db, now: 99 })).toEqual({
        agentsDeleted: 0,
        removedQuestions: [],
      });
      const questions = await db.select<{ readonly id: string }>(
        'SELECT id FROM open_questions ORDER BY id',
      );
      expect(questions.map((row) => row.id)).toEqual(['q-answered', 'q-live']);

      const rows = await db.select<{ readonly id: string; readonly deleted_at: number | null }>(
        'SELECT id, deleted_at FROM agents ORDER BY id',
      );
      expect(rows).toEqual([
        { id: 'live', deleted_at: null },
        { id: 'orphan', deleted_at: 42 },
        { id: 'orphan-child', deleted_at: 42 },
        { id: 'same-workflow', deleted_at: null },
        { id: 'standalone', deleted_at: null },
      ]);
    });
  });

  describe('migration m060 backfill', () => {
    it('existing rows without explicit trigger_mode default to immediate, null chain', async () => {
      await db.execute(
        'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['legacy', sessionId, workflowId, 0, 0, 1, Date.parse(NOW)],
      );
      const runs = await readRunsNewestFirst({ db });
      expect(runs[0]!.triggerMode).toBe('immediate');
      expect(runs[0]!.chainAfterId).toBeUndefined();
    });
  });
});

describe('session hydration carries the orchestrator state', () => {
  let db: Database;

  beforeEach(async () => {
    db = await seed();
  });

  it('reads the reason and the routing on the path the app boots from', async () => {
    await attachWorkflowToSession({
      db,
      sessionId,
      workflowRunId: 'run-1' as WorkflowRunId,
      workflowId,
      autoRun: true,
      updatedAt: NOW,
      triggerMode: 'immediate',
      executionMode: 'dynamic',
    });
    await updateWorkflowRunOrchestrationOutcome(
      db,
      'run-1' as WorkflowRunId,
      'done',
      'the fix and its test are in',
    );
    await updateWorkflowRunOrchestratorRouting(db, 'run-1' as WorkflowRunId, {
      providerId: 'codex',
      model: 'gpt-5.6',
      effort: 'high',
    });
    const sessions = await listSessionsForWorkspace(db, workspaceId);
    const run = sessions[0]!.workflowRuns[0]!;

    expect(run.orchestrationReason).toBe('the fix and its test are in');
    expect(run.orchestratorRouting).toEqual({
      providerId: 'codex',
      model: 'gpt-5.6',
      effort: 'high',
    });
  });
});
