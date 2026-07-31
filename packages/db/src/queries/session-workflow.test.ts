import { beforeEach, describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
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
  updateWorkflowRunOrchestratorRouting,
} from './session-workflow';

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
      await attachWorkflowToSession(db, sessionId, 'run-1' as WorkflowRunId, workflowId, true, NOW);
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs).toHaveLength(1);
      expect(runs[0]!.triggerMode).toBe('immediate');
      expect(runs[0]!.chainAfterId).toBeUndefined();
      expect(runs[0]!.autoRun).toBe(true);
    });

    it('persists manual trigger mode', async () => {
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        false,
        NOW,
        undefined,
        'manual',
      );
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs[0]!.triggerMode).toBe('manual');
      expect(runs[0]!.autoRun).toBe(false);
    });

    it('persists dynamic execution mode', async () => {
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        true,
        NOW,
        undefined,
        'immediate',
        undefined,
        'dynamic',
      );
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs[0]!.executionMode).toBe('dynamic');
    });

    it('persists after_run mode with chain_after_run_id round-trip', async () => {
      await attachWorkflowToSession(db, sessionId, 'pred' as WorkflowRunId, workflowId, true, NOW);
      await attachWorkflowToSession(
        db,
        sessionId,
        'chained' as WorkflowRunId,
        workflowId2,
        true,
        NOW,
        undefined,
        'after_run',
        'pred' as WorkflowRunId,
      );
      const runs = await listWorkflowsForSession(db, sessionId);
      const chained = runs.find((r) => r.id === ('chained' as WorkflowRunId));
      expect(chained!.triggerMode).toBe('after_run');
      expect(chained!.chainAfterId).toBe('pred');
    });

    it('auto-increments ordinal across attaches', async () => {
      await attachWorkflowToSession(db, sessionId, 'r0' as WorkflowRunId, workflowId, true, NOW);
      await attachWorkflowToSession(db, sessionId, 'r1' as WorkflowRunId, workflowId2, true, NOW);
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs.map((r) => r.ordinal)).toEqual([0, 1]);
    });
  });

  describe('listWorkflowsForSession ordering', () => {
    it('returns runs ordered by ordinal ascending', async () => {
      await attachWorkflowToSession(db, sessionId, 'r0' as WorkflowRunId, workflowId, true, NOW);
      await attachWorkflowToSession(db, sessionId, 'r1' as WorkflowRunId, workflowId2, true, NOW);
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs.map((r) => r.id)).toEqual(['r0', 'r1']);
    });

    it('returns empty for a session with no workflows', async () => {
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs).toEqual([]);
    });
  });

  describe('updateSessionWorkflowTriggerMode', () => {
    it('flips an after_run run to immediate', async () => {
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        true,
        NOW,
        undefined,
        'after_run',
        'pred' as WorkflowRunId,
      );
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
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        true,
        NOW,
        undefined,
        'after_run',
        'pred' as WorkflowRunId,
      );
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
      await attachWorkflowToSession(db, sessionId, 'pred' as WorkflowRunId, workflowId, true, NOW);
      await attachWorkflowToSession(
        db,
        sessionId,
        'chained' as WorkflowRunId,
        workflowId2,
        false,
        NOW,
        undefined,
        'after_run',
        'pred' as WorkflowRunId,
      );
      await updateWorkflowOrder(
        db,
        sessionId,
        ['chained' as WorkflowRunId, 'pred' as WorkflowRunId],
        NOW,
      );
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs.map((r) => r.id)).toEqual(['chained', 'pred']);
      const chained = runs.find((r) => r.id === ('chained' as WorkflowRunId));
      expect(chained!.triggerMode).toBe('after_run');
      expect(chained!.chainAfterId).toBe('pred');
      expect(chained!.autoRun).toBe(false);
    });
  });

  describe('per-run goal', () => {
    it('round-trips the goal typed in the builder', async () => {
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        false,
        NOW,
        'just the auth module',
      );
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs[0]!.goal).toBe('just the auth module');
    });

    it('omits the goal when none was typed', async () => {
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        false,
        NOW,
      );
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs[0]!.goal).toBeUndefined();
    });

    it('keeps the goal when runs are reordered', async () => {
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        false,
        NOW,
        'first goal',
      );
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-2' as WorkflowRunId,
        workflowId2,
        false,
        NOW,
        'second goal',
      );
      await updateWorkflowOrder(
        db,
        sessionId,
        ['run-2' as WorkflowRunId, 'run-1' as WorkflowRunId],
        NOW,
      );
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs.map((r) => r.goal)).toEqual(['second goal', 'first goal']);
    });
  });

  describe('updateWorkflowRunOrchestrationOutcome', () => {
    it('attaches with a null outcome by default', async () => {
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        true,
        NOW,
        undefined,
        'immediate',
        undefined,
        'dynamic',
      );
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs[0]!.orchestrationOutcome).toBeUndefined();
    });

    it('round-trips done and blocked outcomes', async () => {
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        true,
        NOW,
        undefined,
        'immediate',
        undefined,
        'dynamic',
      );
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
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        true,
        NOW,
        undefined,
        'immediate',
        undefined,
        'dynamic',
      );
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-2' as WorkflowRunId,
        workflowId2,
        true,
        NOW,
      );
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

  describe('orchestrator reason and routing', () => {
    const attachDynamic = async () =>
      attachWorkflowToSession(
        db,
        sessionId,
        'run-1' as WorkflowRunId,
        workflowId,
        true,
        NOW,
        undefined,
        'immediate',
        undefined,
        'dynamic',
      );

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

    it('carries the reason and the routing through a reorder', async () => {
      await attachDynamic();
      await attachWorkflowToSession(
        db,
        sessionId,
        'run-2' as WorkflowRunId,
        workflowId2,
        true,
        NOW,
      );
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
      await attachWorkflowToSession(db, sessionId, 'run-1' as WorkflowRunId, workflowId, true, NOW);
      await discardWorkflowInSession(db, sessionId, 'run-1' as WorkflowRunId, NOW);
      const runs = await listWorkflowsForSession(db, sessionId);
      expect(runs[0]!.discardedAt).toBe(NOW);
    });
  });

  describe('restoreWorkflowInSession', () => {
    it('clears discarded_at again', async () => {
      await attachWorkflowToSession(db, sessionId, 'run-1' as WorkflowRunId, workflowId, true, NOW);
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
