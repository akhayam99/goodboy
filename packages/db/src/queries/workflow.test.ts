import { beforeEach, describe, expect, it } from 'vitest';
import type { IsoDateTime, StepId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import type { Database } from '../client';
import { deleteWorkflow, getWorkflow, listWorkflows, upsertWorkflow } from './workflow';

const workspaceId = 'ws-1' as WorkspaceId;
const workflowId = 'wf-1' as WorkflowId;
const NOW = '2026-07-25T00:00:00.000Z' as IsoDateTime;

const buildWorkflow = (): Workflow => ({
  id: workflowId,
  workspaceId,
  name: 'Refactor',
  description: 'planner reasoning',
  goal: 'keep behavior identical',
  processText: 'scout the area, then plan, then implement',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: 'map the area',
      expectedOutput: 'a file map with file:line references',
    },
    {
      id: 'step-2' as StepId,
      workflowId,
      ordinal: 1,
      name: 'Plan',
      promptPrefix: 'draft the plan',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
});

describe('workflow queries', () => {
  let db: Database;

  beforeEach(async () => {
    db = makeTestDatabase();
    await migrate(db);
    await db.execute(
      'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'ws', '/tmp/ws', Date.now(), Date.now()],
    );
  });

  it('round-trips the step expected output and the workflow process text', async () => {
    await upsertWorkflow(db, buildWorkflow());

    const stored = await getWorkflow(db, workflowId);

    expect(stored!.processText).toBe('scout the area, then plan, then implement');
    expect(stored!.steps[0]!.expectedOutput).toBe('a file map with file:line references');
    expect(stored!.steps[1]!.expectedOutput).toBeUndefined();
  });

  it('overwrites the expected output on re-save instead of keeping the stale one', async () => {
    const workflow = buildWorkflow();
    await upsertWorkflow(db, workflow);
    await upsertWorkflow(db, {
      ...workflow,
      steps: [{ ...workflow.steps[0]!, expectedOutput: 'a ranked risk list' }],
    });

    const stored = await getWorkflow(db, workflowId);

    expect(stored!.steps[0]!.expectedOutput).toBe('a ranked risk list');
  });

  it('allows recreating a workflow with the name of a deleted one', async () => {
    await upsertWorkflow(db, buildWorkflow());
    await deleteWorkflow(db, workflowId);
    await upsertWorkflow(db, { ...buildWorkflow(), id: 'wf-2' as WorkflowId, steps: [] });

    const live = await listWorkflows(db, workspaceId);

    expect(live.map((workflow) => workflow.id)).toEqual(['wf-2']);
    expect(live[0]!.name).toBe('Refactor');
  });

  it('still rejects a duplicate name among live workflows', async () => {
    await upsertWorkflow(db, buildWorkflow());

    await expect(
      upsertWorkflow(db, { ...buildWorkflow(), id: 'wf-2' as WorkflowId, steps: [] }),
    ).rejects.toThrow();
  });
});
