import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';
import type { ProjectId } from '@goodboy/types';
import { listProjectScripts, upsertProjectScript } from '../queries/project-script';

type IdParams = {
  readonly value: string;
};

const idOf = <Id extends string>({ value }: IdParams): Id => JSON.parse(JSON.stringify(value));

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 233 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at) VALUES ('project', 'workspace', 'ledger-core', '/repo/ledger-core', 'repo', 1, 1)",
  );
  await db.execute(
    "INSERT INTO project_scripts (id, project_id, name, body, sort_order, created_at, updated_at) VALUES ('deploy', 'project', 'deploy', 'echo ledger', 0, 1, 1)",
  );
  const result = await migrateThrough({ db, version: 234 });
  expect(result.applied).toEqual([234]);
  return db;
};

describe('m234 script enabled', () => {
  it('keeps every existing script enabled', async () => {
    const db = await seed();
    const rows = await db.select<{ is_enabled: number }>(
      "SELECT is_enabled FROM project_scripts WHERE id = 'deploy'",
    );
    expect(rows[0]?.is_enabled).toBe(1);
  });

  it('enables a disabled script when the person saves it', async () => {
    const db = await seed();
    await db.execute("UPDATE project_scripts SET is_enabled = 0 WHERE id = 'deploy'");
    const [script] = await listProjectScripts({
      db,
      projectId: idOf<ProjectId>({ value: 'project' }),
    });
    if (script === undefined) {
      throw new Error('seeded script missing');
    }
    await upsertProjectScript({ db, script });
    const rows = await db.select<{ is_enabled: number }>(
      "SELECT is_enabled FROM project_scripts WHERE id = 'deploy'",
    );
    expect(rows[0]?.is_enabled).toBe(1);
  });

  it('defaults a new script to enabled', async () => {
    const db = await seed();
    await db.execute(
      "INSERT INTO project_scripts (id, project_id, name, body, sort_order, created_at, updated_at) VALUES ('lint', 'project', 'lint', 'echo lint', 1, 1, 1)",
    );
    const rows = await db.select<{ is_enabled: number }>(
      "SELECT is_enabled FROM project_scripts WHERE id = 'lint'",
    );
    expect(rows[0]?.is_enabled).toBe(1);
  });
});
