import { describe, expect, it } from 'vitest';
import type { StepDefId, StepId, WorkflowId } from '@goodboy/types';
import type { Database } from '../client';
import { getWorkflow, upsertWorkflow } from '../queries/workflow';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { m180StepLibraryBuiltinsInCode } from './m180-step-library-builtins-in-code';
import { migrate } from './runner';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');

const BUILTIN_IDS = [
  'seed_docs',
  'seed_implementer',
  'seed_investigator',
  'seed_planner',
  'seed_resolver',
  'seed_reviewer',
  'seed_scout',
  'seed_tester',
];

const seedThrough173 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 173 });
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Harborline', 'harborline', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO step_library (id, workspace_id, role, name, prompt_prefix, created_at, updated_at)
     VALUES ('lib-copy', 'workspace-1', 'tester', 'Dry run replay', 'Replay settled batches.', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at)
     VALUES ('wf-refactor', 'workspace-1', 'Refactor', '', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO steps (id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix)
     VALUES ('step-scout', 'wf-refactor', 'seed_scout', 'scout', 0, 'Scout', 'Map the area.')`,
  );
  return db;
};

type LibraryRow = {
  readonly id: string;
  readonly deleted_at: number | null;
};

const globalRows = async (db: Database): Promise<ReadonlyArray<LibraryRow>> =>
  db.select<LibraryRow>(
    'SELECT id, deleted_at FROM step_library WHERE workspace_id IS NULL ORDER BY id ASC',
  );

describe('m180 step library built-ins in code', () => {
  it('soft deletes every global row and keeps one for each built-in step', async () => {
    const db = await seedThrough173();
    expect((await globalRows(db)).some((row) => row.deleted_at === null)).toBe(true);

    await migrate(db, migrations);

    const rows = await globalRows(db);
    expect(rows.map((row) => row.id)).toEqual(BUILTIN_IDS);
    expect(rows.every((row) => row.deleted_at !== null)).toBe(true);
  });

  it('leaves the steps a workspace saved untouched', async () => {
    const db = await seedThrough173();

    await migrate(db, migrations);

    expect(
      await db.select(
        'SELECT id, name, deleted_at FROM step_library WHERE workspace_id IS NOT NULL',
      ),
    ).toEqual([{ id: 'lib-copy', name: 'Dry run replay', deleted_at: null }]);
  });

  it('keeps a workflow that points at a built-in row working', async () => {
    const db = await seedThrough173();

    await migrate(db, migrations);

    const workflow = await getWorkflow(db, 'wf-refactor' as WorkflowId);
    expect(workflow?.steps.map((step) => step.libraryStepId)).toEqual(['seed_scout']);
    expect(workflow?.steps.map((step) => step.name)).toEqual(['Scout']);
  });

  it('lets a workflow point at a built-in step that never had a row', async () => {
    const db = await seedThrough173();
    await migrate(db, migrations);
    const workflow = await getWorkflow(db, 'wf-refactor' as WorkflowId);
    if (workflow === null) {
      throw new Error('workflow missing');
    }
    const [scout] = workflow.steps;
    if (scout === undefined) {
      throw new Error('step missing');
    }

    await upsertWorkflow(db, {
      ...workflow,
      steps: [
        scout,
        {
          ...scout,
          id: 'step-docs' as StepId,
          ordinal: 1,
          libraryStepId: 'seed_docs' as StepDefId,
        },
      ],
    });

    const saved = await getWorkflow(db, 'wf-refactor' as WorkflowId);
    expect(saved?.steps.map((step) => step.libraryStepId)).toEqual(['seed_scout', 'seed_docs']);
  });

  it('runs again after a crash without changing the result', async () => {
    const db = await seedThrough173();
    await migrate(db, migrations);
    const before = await globalRows(db);

    for (const statement of m180StepLibraryBuiltinsInCode.split(';')) {
      if (statement.trim() !== '') {
        await db.execute(statement);
      }
    }

    expect(await globalRows(db)).toEqual(before);
  });
});
