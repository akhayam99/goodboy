import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getWorkspaceOverrides, setWorkspaceOverrides } from '../queries/settings-overrides';
import { migrations } from './index';
import { migrate } from './runner';

const HARBORLINE = 'harborline' as WorkspaceId;
const NORTHWIND = 'northwind' as WorkspaceId;

const seedBefore = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 216 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('harborline', 'Harborline', 'harborline', 1, 1)",
  );
  await migrate(db, migrations);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('northwind', 'Northwind', 'northwind', 2, 2)",
  );
  return db;
};

describe('m217 workflow rules', () => {
  it('turns spreading off for workspaces that existed and leaves new ones on the default', async () => {
    const db = await seedBefore();

    const existing = await getWorkspaceOverrides(db, HARBORLINE);
    const created = await getWorkspaceOverrides(db, NORTHWIND);

    expect(existing?.workflowRules?.spreadByHeadroom).toBe(false);
    expect(existing?.workflowRules?.autonomy).toBe('step');
    expect(created?.workflowRules).toBeNull();
    expect(DEFAULT_WORKFLOW_RULES.spreadByHeadroom).toBe(true);
  });

  it('saves the rules, reads them back, and clears them on restore', async () => {
    const db = await seedBefore();
    const before = await getWorkspaceOverrides(db, NORTHWIND);
    if (before === null) {
      throw new Error('workspace missing');
    }
    const rules = {
      ...DEFAULT_WORKFLOW_RULES,
      autonomy: 'plan' as const,
      spendLimitUsd: 25,
      standingGuidance: '- Group the commits by concern at the end.',
    };

    await setWorkspaceOverrides(db, NORTHWIND, { ...before, workflowRules: rules });
    const saved = await getWorkspaceOverrides(db, NORTHWIND);
    await setWorkspaceOverrides(db, NORTHWIND, { ...before, workflowRules: null });
    const restored = await getWorkspaceOverrides(db, NORTHWIND);

    expect(saved?.workflowRules).toEqual(rules);
    expect(restored?.workflowRules).toBeNull();
  });
});
