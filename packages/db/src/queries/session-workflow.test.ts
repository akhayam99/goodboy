import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  RoleModelPreferences,
  SessionId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import type { Database } from '../client';
import {
  attachWorkflowToSession,
  discardWorkflowInSession,
  listWorkflowsForSession,
  restoreWorkflowInSession,
  updateSessionWorkflowTriggerMode,
  updateWorkflowOrder,
  updateWorkflowRunOrchestrationOutcome,
  updateWorkflowRunOrchestrationStop,
  updateWorkflowRunOrchestratorRouting,
  updateWorkflowRunRoleModelOverrides,
  updateWorkflowRunSpendLimit,
} from './session-workflow';
import { listSessionsForWorkspace } from './session';

const workspaceId = 'ws-1' as WorkspaceId;
const sessionId = 'ses-1' as SessionId;
const workflowId = 'wf-1' as WorkflowId;
const workflowId2 = 'wf-2' as WorkflowId;
const NOW = '2026-06-12T00:00:00.000Z' as IsoDateTime;

async function seed(): Promise<Database> {
  const db = makeTestDatabase();
  await migrate(db);
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, description) VALUES (?, ?, ?, ?)',
    [workflowId, workspaceId, 'Workflow 1', ''],
  );
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, description) VALUES (?, ?, ?, ?)',
    [workflowId2, workspaceId, 'Workflow 2', ''],
  );
  return db;
}

describe('session_workflows trigger-mode queries', () => {
  let db: Database;

  beforeEach(async () => {
    db = await seed();
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const runs = await listWorkflowsForSession(db, sessionId);
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

      const runs = await listWorkflowsForSession(db, sessionId);

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

      const runs = await listWorkflowsForSession(db, sessionId);

      expect(runs[0]!.orchestratorRouting).toBeUndefined();
    });

    it('round-trips the per-run role model overrides', async () => {
      const roleModelOverrides = {
        implementer: {
          providerId: 'codex',
          model: 'gpt-5.6-sol',
          effort: 'high',
        },
      } satisfies RoleModelPreferences;
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
        executionMode: 'dynamic',
      });
      await updateWorkflowRunRoleModelOverrides(db, 'run-1' as WorkflowRunId, roleModelOverrides);

      const runs = await listWorkflowsForSession(db, sessionId);

      expect(runs[0]!.roleModelOverrides).toEqual(roleModelOverrides);

      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-2' as WorkflowRunId,
        workflowId: workflowId2,
        autoRun: false,
        updatedAt: NOW,
      });
      await updateWorkflowOrder(
        db,
        sessionId,
        ['run-2' as WorkflowRunId, 'run-1' as WorkflowRunId],
        NOW,
      );

      const reordered = await listWorkflowsForSession(db, sessionId);
      expect(
        reordered.find((run) => run.id === ('run-1' as WorkflowRunId))!.roleModelOverrides,
      ).toEqual(roleModelOverrides);
    });

    it('clears the per-run role model overrides when every role is reset', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
        executionMode: 'dynamic',
      });
      await updateWorkflowRunRoleModelOverrides(db, 'run-1' as WorkflowRunId, {
        implementer: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
      });
      await updateWorkflowRunRoleModelOverrides(db, 'run-1' as WorkflowRunId, {});

      const runs = await listWorkflowsForSession(db, sessionId);

      expect(runs[0]!.roleModelOverrides).toBeUndefined();
    });

    it('drops malformed persisted role model overrides', async () => {
      await attachWorkflowToSession({
        db,
        sessionId,
        workflowRunId: 'run-1' as WorkflowRunId,
        workflowId,
        autoRun: false,
        updatedAt: NOW,
        executionMode: 'dynamic',
      });
      await db.execute(
        'UPDATE session_workflows SET role_model_overrides = ? WHERE workflow_run_id = ?',
        [
          JSON.stringify({
            implementer: {
              providerId: 'codex',
              model: 'gpt-5.6-sol',
              effort: 'high',
              fallback: { providerId: 'unknown', model: 'broken' },
            },
            planner: {
              providerId: 'unknown',
              model: 'model',
              effort: 'high',
            },
            reviewer: {
              providerId: 'anthropic',
              model: '',
              effort: 'medium',
            },
            tester: {
              providerId: 'gemini',
              model: 'gemini-3.1-pro',
              effort: 'turbo',
            },
            unsupported: {
              providerId: 'anthropic',
              model: 'claude-sonnet-4-6',
              effort: 'high',
            },
          }),
          'run-1',
        ],
      );

      const runs = await listWorkflowsForSession(db, sessionId);

      expect(runs[0]!.roleModelOverrides).toEqual({
        implementer: {
          providerId: 'codex',
          model: 'gpt-5.6-sol',
          effort: 'high',
        },
      });
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs.find((r) => r.id === ('r0' as WorkflowRunId))!.createdAt).toBe(
        '2026-08-05T09:14:22.000Z',
      );
    });
  });

  describe('listWorkflowsForSession ordering', () => {
    it('returns runs newest first, by ordinal descending', async () => {
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
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs.map((r) => r.id)).toEqual(['r1', 'r0']);
    });

    it('returns empty for a session with no workflows', async () => {
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs).toEqual([]);
    });
  });

  describe('updateSessionWorkflowTriggerMode', () => {
    it('flips an after_run run to immediate', async () => {
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
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs[0]!.triggerMode).toBe('immediate');
    });

    it('flips a chained run to manual without clearing chain_after_run_id', async () => {
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const run = (await listWorkflowsForSession(db, sessionId))[0]!;
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
      const capped = (await listWorkflowsForSession(db, sessionId))[0]!;
      expect(capped.spendLimitUsd).toBe(7.5);
      expect(capped.spendLimitMode).toBe('notify');

      await updateWorkflowRunSpendLimit(db, 'run-1' as WorkflowRunId, null, 'pause');
      const uncapped = (await listWorkflowsForSession(db, sessionId))[0]!;
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
      const run = (await listWorkflowsForSession(db, sessionId)).find(
        (candidate) => candidate.id === ('run-1' as WorkflowRunId),
      )!;
      expect(run.spendLimitUsd).toBe(12.5);
      expect(run.spendLimitMode).toBe('notify');
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs.map((r) => [r.id, r.goal])).toEqual([
        ['run-1', 'first goal'],
        ['run-2', 'second goal'],
      ]);
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      expect((await listWorkflowsForSession(db, sessionId))[0]!.orchestrationOutcome).toBe('done');
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, 'blocked');
      expect((await listWorkflowsForSession(db, sessionId))[0]!.orchestrationOutcome).toBe(
        'blocked',
      );
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, null);
      expect(
        (await listWorkflowsForSession(db, sessionId))[0]!.orchestrationOutcome,
      ).toBeUndefined();
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      expect((await listWorkflowsForSession(db, sessionId))[0]!.orchestrationStop).toEqual({
        kind: 'budget',
        message: 'the budget cap is reached, raise it in Budget to keep this run going',
      });

      await updateWorkflowRunOrchestrationStop(db, 'run-1' as WorkflowRunId, {
        kind: 'failure',
        message: 'usage limit reached (anthropic/haiku-4.5)',
      });
      expect((await listWorkflowsForSession(db, sessionId))[0]!.orchestrationStop).toEqual({
        kind: 'failure',
        message: 'usage limit reached (anthropic/haiku-4.5)',
      });

      await updateWorkflowRunOrchestrationStop(db, 'run-1' as WorkflowRunId, null);
      expect((await listWorkflowsForSession(db, sessionId))[0]!.orchestrationStop).toBeUndefined();
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
      const runs = await listWorkflowsForSession(db, sessionId);
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
      const run = (await listWorkflowsForSession(db, sessionId))[0]!;
      expect(run.orchestrationReason).toBe('the fix and its test are in, the docs are left');
    });

    it('drops the reason when the run is reopened', async () => {
      await attachDynamic();
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, 'done', 'all set');
      await updateWorkflowRunOrchestrationOutcome(db, 'run-1' as WorkflowRunId, null);
      const run = (await listWorkflowsForSession(db, sessionId))[0]!;
      expect(run.orchestrationReason).toBeUndefined();
    });

    it('round-trips the routing pinned on the run and clears it', async () => {
      await attachDynamic();
      await updateWorkflowRunOrchestratorRouting(db, 'run-1' as WorkflowRunId, {
        providerId: 'codex',
        model: 'gpt-5.6',
        effort: 'high',
      });
      expect((await listWorkflowsForSession(db, sessionId))[0]!.orchestratorRouting).toEqual({
        providerId: 'codex',
        model: 'gpt-5.6',
        effort: 'high',
      });
      await updateWorkflowRunOrchestratorRouting(db, 'run-1' as WorkflowRunId, null);
      expect(
        (await listWorkflowsForSession(db, sessionId))[0]!.orchestratorRouting,
      ).toBeUndefined();
    });

    it('reads a run that still carries the retired step routing columns', async () => {
      await attachDynamic();
      await db.execute(
        'UPDATE session_workflows SET step_provider = ?, step_model = ?, step_effort = ? WHERE workflow_run_id = ?',
        ['codex', 'gpt-5.6-terra', 'high', 'run-1' as WorkflowRunId],
      );

      const run = (await listWorkflowsForSession(db, sessionId))[0]!;

      expect(run.id).toBe('run-1');
      expect(run.executionMode).toBe('dynamic');
      expect(Object.keys(run)).not.toContain('stepRouting');
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
      const run = (await listWorkflowsForSession(db, sessionId)).find(
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
      await discardWorkflowInSession(db, sessionId, 'run-1' as WorkflowRunId, NOW);
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs[0]!.discardedAt).toBe(NOW);
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
      await discardWorkflowInSession(db, sessionId, 'run-1' as WorkflowRunId, NOW);
      await restoreWorkflowInSession(db, sessionId, 'run-1' as WorkflowRunId, NOW);
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs[0]!.discardedAt).toBeUndefined();
    });
  });

  describe('migration m060 backfill', () => {
    it('existing rows without explicit trigger_mode default to immediate, null chain', async () => {
      await db.execute(
        'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run) VALUES (?, ?, ?, ?, ?, ?)',
        ['legacy', sessionId, workflowId, 0, 0, 1],
      );
      const runs = await listWorkflowsForSession(db, sessionId);
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
