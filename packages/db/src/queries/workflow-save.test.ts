import { beforeEach, describe, expect, it } from 'vitest';
import type { WorkflowId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { NotFoundError } from '../shared/errors';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getWorkflow, removeWorkflow, saveWorkflow, type SaveWorkflowInput } from './workflow';

const workspaceId = 'ws-harborline' as WorkspaceId;

const malformed = (json: string) => JSON.parse(json);

const draft = (overrides: Partial<SaveWorkflowInput> = {}): SaveWorkflowInput => ({
  workspaceId,
  name: 'Close the books',
  description: 'Reconcile the ledger',
  steps: [
    { ordinal: 0, name: 'Reconcile', promptPrefix: 'reconcile the ledger export' },
    { ordinal: 1, name: 'Review', promptPrefix: 'review the reconciliation' },
  ],
  ...overrides,
});

type StepRow = {
  readonly id: string;
  readonly name: string;
  readonly deleted_at: number | null;
};

describe('saveWorkflow', () => {
  let db: Database;

  beforeEach(async () => {
    db = await makeMigratedTestDatabase();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
      [workspaceId, 'Harborline', 'harborline'],
    );
  });

  const stepRows = (workflowId: string) =>
    db.select<StepRow>(
      'SELECT id, name, deleted_at FROM steps WHERE workflow_id = ? ORDER BY ordinal',
      [workflowId],
    );

  describe('identity', () => {
    it('creates a preset with generated ids and returns what it stored', async () => {
      const saved = await saveWorkflow(db, draft({ goal: 'close in three days' }));

      expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(saved).toMatchObject({
        workspaceId,
        name: 'Close the books',
        goal: 'close in three days',
        isPreset: true,
      });
      expect(saved.steps.map((step) => [step.name, step.ordinal, step.workflowId])).toEqual([
        ['Reconcile', 0, saved.id],
        ['Review', 1, saved.id],
      ]);
      expect(saved.steps.every((step) => /^[0-9a-f-]{36}$/.test(step.id))).toBe(true);
    });

    it('updates the live preset of the same name when no id is given', async () => {
      const first = await saveWorkflow(db, draft());

      const second = await saveWorkflow(db, draft({ description: 'edited' }));

      expect(second.id).toBe(first.id);
      expect(second.description).toBe('edited');
      expect(await db.select('SELECT id FROM workflows')).toHaveLength(1);
    });

    it('does not reuse a soft-deleted preset of the same name', async () => {
      const first = await saveWorkflow(db, draft());
      await db.execute('UPDATE workflows SET deleted_at = 1 WHERE id = ?', [first.id]);

      const second = await saveWorkflow(db, draft());

      expect(second.id).not.toBe(first.id);
    });

    it('revives a soft-deleted workflow saved again by id', async () => {
      const first = await saveWorkflow(db, draft());
      await db.execute('UPDATE workflows SET deleted_at = 1 WHERE id = ?', [first.id]);

      const revived = await saveWorkflow(db, draft({ id: first.id }));

      expect(revived.deletedAt).toBeUndefined();
    });

    it('keeps the creation time and moves the update time', async () => {
      const first = await saveWorkflow(db, draft());
      await db.execute('UPDATE workflows SET created_at = 1000, updated_at = 1000 WHERE id = ?', [
        first.id,
      ]);

      const second = await saveWorkflow(db, draft({ id: first.id, description: 'edited' }));

      expect(Date.parse(second.createdAt)).toBe(1000);
      expect(Date.parse(second.updatedAt)).toBeGreaterThan(1000);
    });

    it('keeps the origin of a workflow saved again without one', async () => {
      const first = await saveWorkflow(db, draft({ origin: 'orchestrated' }));

      const second = await saveWorkflow(db, draft({ id: first.id, origin: undefined }));

      expect(second.origin).toBe('orchestrated');
    });
  });

  describe('live names', () => {
    it('keeps a free name', async () => {
      const first = await saveWorkflow(db, draft({ name: 'Orchestrated workflow' }));
      await db.execute('UPDATE workflows SET deleted_at = 1 WHERE id = ?', [first.id]);

      const second = await saveWorkflow(db, draft({ name: 'Orchestrated workflow' }));

      expect(second.name).toBe('Orchestrated workflow');
    });

    it('suffixes a name held by a live preset, skipping suffixes already held', async () => {
      await saveWorkflow(db, draft({ name: 'Orchestrated workflow' }));
      await saveWorkflow(db, draft({ name: 'Orchestrated workflow 2' }));

      const third = await saveWorkflow(
        db,
        draft({ name: 'Orchestrated workflow', id: 'w3' as WorkflowId }),
      );

      expect(third.name).toBe('Orchestrated workflow 3');
    });

    it('ignores the row being updated', async () => {
      const first = await saveWorkflow(db, draft({ name: 'Ship It' }));

      const again = await saveWorkflow(db, draft({ name: 'Ship It', id: first.id }));

      expect(again.name).toBe('Ship It');
    });

    it('keeps the preset name on a run copy', async () => {
      await saveWorkflow(db, draft({ name: 'Ship it' }));

      const copy = await saveWorkflow(
        db,
        draft({ name: 'Ship it', id: 'w2' as WorkflowId, isPreset: false }),
      );

      expect(copy.name).toBe('Ship it');
      expect(copy.isPreset).toBe(false);
    });

    it('ignores live run copies when a preset takes the name', async () => {
      await saveWorkflow(db, draft({ name: 'Ship it', id: 'w1' as WorkflowId, isPreset: false }));

      const preset = await saveWorkflow(db, draft({ name: 'Ship it', id: 'w2' as WorkflowId }));

      expect(preset.name).toBe('Ship it');
    });

    it('suffixes a run copy promoted to preset', async () => {
      await saveWorkflow(db, draft({ name: 'Ship it', id: 'w1' as WorkflowId }));
      const copy = await saveWorkflow(
        db,
        draft({ name: 'Ship it', id: 'w2' as WorkflowId, isPreset: false }),
      );

      const promoted = await saveWorkflow(
        db,
        draft({ name: 'Ship it', id: copy.id, isPreset: true }),
      );

      expect(promoted.name).toBe('Ship it 2');
    });
  });

  describe('overlapping saves', () => {
    const blind = (target: Database, tables: RegExp): Database => {
      let looks = 0;
      return {
        ...target,
        select: async <T>(sql: string, params?: ReadonlyArray<unknown>) => {
          if (looks < 2 && tables.test(sql)) {
            looks += 1;
            return [];
          }
          return target.select<T>(sql, params);
        },
      };
    };

    it('updates the preset another save just created instead of failing on the name', async () => {
      const winner = await saveWorkflow(db, draft({ description: 'first' }));
      const loser = blind(db, /FROM workflows\s+WHERE workspace_id = \? AND (name|id <>)/);

      const saved = await saveWorkflow(loser, draft({ description: 'second' }));

      expect(saved.id).toBe(winner.id);
      expect(saved.description).toBe('second');
      expect(await db.select('SELECT id FROM workflows')).toHaveLength(1);
    });

    it('takes the next suffix when a save by id loses the name to another save', async () => {
      const winner = await saveWorkflow(db, draft());
      const loser = blind(db, /SELECT name FROM workflows/);

      const saved = await saveWorkflow(loser, draft({ id: 'w-late' as WorkflowId }));

      expect(saved.name).toBe('Close the books 2');
      expect(saved.id).toBe('w-late');
      expect((await getWorkflow(db, winner.id))?.name).toBe('Close the books');
    });
  });

  describe('steps', () => {
    it('keeps the id of a step saved again so agents keep their link', async () => {
      const first = await saveWorkflow(db, draft());
      const [reconcile, review] = first.steps;

      const second = await saveWorkflow(
        db,
        draft({
          id: first.id,
          steps: [
            { id: reconcile!.id, ordinal: 0, name: 'Reconcile v2', promptPrefix: 'again' },
            {
              id: review!.id,
              ordinal: 1,
              name: 'Review',
              promptPrefix: 'review the reconciliation',
            },
          ],
        }),
      );

      expect(second.steps.map((step) => [step.id, step.name])).toEqual([
        [reconcile!.id, 'Reconcile v2'],
        [review!.id, 'Review'],
      ]);
    });

    it('soft-deletes a step the edit removed and keeps its row', async () => {
      const first = await saveWorkflow(db, draft());
      const [reconcile, review] = first.steps;

      const second = await saveWorkflow(
        db,
        draft({
          id: first.id,
          steps: [{ id: reconcile!.id, ordinal: 0, name: 'Reconcile', promptPrefix: 'x' }],
        }),
      );

      expect(second.steps.map((step) => step.id)).toEqual([reconcile!.id]);
      const rows = await stepRows(first.id);
      expect(rows.map((row) => [row.id, row.deleted_at === null])).toEqual([
        [reconcile!.id, true],
        [review!.id, false],
      ]);
    });

    it('brings a removed step back when the edit adds it again', async () => {
      const first = await saveWorkflow(db, draft());
      const [reconcile, review] = first.steps;
      await saveWorkflow(
        db,
        draft({
          id: first.id,
          steps: [{ id: reconcile!.id, ordinal: 0, name: 'Reconcile', promptPrefix: 'x' }],
        }),
      );

      const third = await saveWorkflow(
        db,
        draft({
          id: first.id,
          steps: [
            { id: reconcile!.id, ordinal: 0, name: 'Reconcile', promptPrefix: 'x' },
            { id: review!.id, ordinal: 1, name: 'Review', promptPrefix: 'y' },
          ],
        }),
      );

      expect(third.steps.map((step) => step.id)).toEqual([reconcile!.id, review!.id]);
    });

    it('soft-deletes every step when the edit gives none', async () => {
      const first = await saveWorkflow(db, draft());

      const second = await saveWorkflow(db, draft({ id: first.id, steps: [] }));

      expect(second.steps).toEqual([]);
      expect((await stepRows(first.id)).every((row) => row.deleted_at !== null)).toBe(true);
    });

    it('keeps only a known size', async () => {
      const saved = await saveWorkflow(
        db,
        draft({
          steps: [
            { ordinal: 0, name: 'A', promptPrefix: 'a', size: 'large' },
            { ordinal: 1, name: 'B', promptPrefix: 'b', size: malformed('"huge"') },
          ],
        }),
      );

      expect(saved.steps.map((step) => step.size)).toEqual(['large', undefined]);
    });

    it('rejects an invalid routing value and writes nothing', async () => {
      const first = await saveWorkflow(db, draft());

      await expect(
        saveWorkflow(
          db,
          draft({
            id: first.id,
            name: 'Renamed',
            steps: [
              {
                ordinal: 0,
                name: 'Reconcile',
                promptPrefix: 'x',
                taskProfile: malformed('{"taskType":"nope"}'),
              },
            ],
          }),
        ),
      ).rejects.toThrow('Invalid task profile');

      const stored = await getWorkflow(db, first.id);
      expect(stored?.name).toBe('Close the books');
      expect(stored?.steps).toHaveLength(2);
    });
  });
});

describe('removeWorkflow', () => {
  let db: Database;

  beforeEach(async () => {
    db = await makeMigratedTestDatabase();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
      [workspaceId, 'Harborline', 'harborline'],
    );
  });

  const seed = async (id: string): Promise<WorkflowId> => {
    await db.execute(
      'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
      [id, workspaceId, `Close the books ${id}`],
    );
    await db.execute(
      "INSERT INTO steps (id, workflow_id, ordinal, name) VALUES (?, ?, 0, 'Reconcile')",
      [`${id}-step`, id],
    );
    return id as WorkflowId;
  };

  const counts = async (id: string) => ({
    workflows: (await db.select('SELECT id FROM workflows WHERE id = ?', [id])).length,
    steps: (await db.select('SELECT id FROM steps WHERE workflow_id = ?', [id])).length,
  });

  it('refuses a workflow that does not exist', async () => {
    await expect(removeWorkflow(db, 'missing' as WorkflowId)).rejects.toThrow(
      new NotFoundError('workflow', 'missing'),
    );
  });

  it('hard-deletes a workflow nobody uses, steps included', async () => {
    const id = await seed('wf-draft');

    await removeWorkflow(db, id);

    expect(await counts(id)).toEqual({ workflows: 0, steps: 0 });
  });

  it('soft-deletes a seeded preset so restore defaults can bring it back', async () => {
    const id = await seed('wf_seed_close');

    await removeWorkflow(db, id);

    expect(await counts(id)).toEqual({ workflows: 1, steps: 1 });
    const stored = await getWorkflow(db, id);
    expect(stored?.deletedAt).toBeDefined();
  });

  it('soft-deletes a workflow a session still uses', async () => {
    const id = await seed('wf-attached');
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('s1', ?, 'g', 'idle', 1, 1)",
      [workspaceId],
    );
    await db.execute(
      "INSERT INTO session_workflows (session_id, workflow_id, workflow_run_id, ordinal, created_at) VALUES ('s1', ?, 'run-1', 0, 1)",
      [id],
    );

    await removeWorkflow(db, id);

    expect(await counts(id)).toEqual({ workflows: 1, steps: 1 });
    expect((await getWorkflow(db, id))?.deletedAt).toBeDefined();
  });

  it('keeps a workflow a session attached after the look and before the delete', async () => {
    const id = await seed('wf-late');
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('s1', ?, 'g', 'idle', 1, 1)",
      [workspaceId],
    );
    const attachLate: Database = {
      ...db,
      transaction: async (params) => {
        await db.execute(
          "INSERT INTO session_workflows (session_id, workflow_id, workflow_run_id, ordinal, created_at) VALUES ('s1', ?, 'run-1', 0, 1)",
          [id],
        );
        return db.transaction(params);
      },
    };

    await removeWorkflow(attachLate, id);

    expect(await counts(id)).toEqual({ workflows: 1, steps: 1 });
    expect((await getWorkflow(db, id))?.deletedAt).toBeDefined();
    expect(await db.select('SELECT workflow_run_id FROM session_workflows')).toHaveLength(1);
  });

  it('leaves other workflows alone', async () => {
    const keep = await seed('wf-keep');
    const drop = await seed('wf-drop');

    await removeWorkflow(db, drop);

    expect(await counts(keep)).toEqual({ workflows: 1, steps: 1 });
  });
});
