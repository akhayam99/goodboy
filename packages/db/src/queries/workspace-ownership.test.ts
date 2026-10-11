import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';

type Fate =
  | 'moved'
  | 'deleted-by-merge'
  | 'lost-with-the-source'
  | 'detached'
  | 'follows-project'
  | 'follows-session';

const FATES: Readonly<Record<string, Fate>> = {
  projects: 'moved',
  sessions: 'moved',
  session_context_items: 'moved',
  integration_bindings: 'moved',
  workspace_external_tasks: 'moved',
  workspace_profiles: 'deleted-by-merge',
  notifications: 'detached',
  retained_worktree_paths: 'detached',
  pr_series: 'follows-project',
  project_relocations: 'follows-project',
  project_scripts: 'follows-project',
  search_excluded_projects: 'follows-project',
  session_worktrees: 'follows-project',
  diff_comments: 'follows-session',
  resolve_threads: 'follows-session',
  session_external_tasks: 'follows-session',
  agent_turn_spans: 'lost-with-the-source',
  chats: 'lost-with-the-source',
  deleted_branches: 'lost-with-the-source',
  integration_drafts: 'lost-with-the-source',
  permission_rules: 'lost-with-the-source',
  project_sentry_links: 'lost-with-the-source',
  search_docs: 'lost-with-the-source',
  security_findings: 'lost-with-the-source',
  skills: 'lost-with-the-source',
  step_library: 'lost-with-the-source',
  workflows: 'lost-with-the-source',
  workspace_starred_issues: 'lost-with-the-source',
};

const MERGE_SOURCE = readFileSync(join(import.meta.dirname, 'workspace-merge.ts'), 'utf8');

type TableInfoRow = { readonly name: string };

type ForeignKeyRow = {
  readonly table: string;
  readonly from: string;
  readonly on_delete: string;
};

type OwnedTable = {
  readonly table: string;
  readonly columns: ReadonlyArray<string>;
  readonly foreignKeys: ReadonlyArray<ForeignKeyRow>;
};

type DbParams = { readonly db: Database };

type NamesParams = {
  readonly found: ReadonlyArray<string>;
  readonly classified: ReadonlyArray<string>;
};

const unclassifiedTables = ({ found, classified }: NamesParams): ReadonlyArray<string> =>
  found.filter((table) => !classified.includes(table));

const ownedTables = async ({ db }: DbParams): Promise<ReadonlyArray<OwnedTable>> => {
  const tables = await db.select<TableInfoRow>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const owned: OwnedTable[] = [];
  for (const { name } of tables) {
    const columns = (await db.select<TableInfoRow>(`PRAGMA table_info("${name}")`)).map(
      (column) => column.name,
    );
    if (!columns.includes('workspace_id') && !columns.includes('project_id')) {
      continue;
    }
    owned.push({
      table: name,
      columns,
      foreignKeys: await db.select<ForeignKeyRow>(`PRAGMA foreign_key_list("${name}")`),
    });
  }
  return owned;
};

type ActionParams = {
  readonly owned: OwnedTable;
  readonly column: string;
  readonly parent: string;
};

const actionOf = ({ owned, column, parent }: ActionParams): string | undefined =>
  owned.foreignKeys.find((key) => key.from === column && key.table === parent)?.on_delete;

const CLEANS_UP = ['CASCADE', 'SET NULL'];

type DeleteGapParams = { readonly owned: ReadonlyArray<OwnedTable> };

const deleteGaps = ({ owned }: DeleteGapParams): ReadonlyArray<string> =>
  owned.flatMap((entry) => {
    const gaps: string[] = [];
    if (entry.columns.includes('workspace_id')) {
      const action = actionOf({ owned: entry, column: 'workspace_id', parent: 'workspaces' });
      if (action === undefined || !CLEANS_UP.includes(action)) {
        gaps.push(`${entry.table}.workspace_id`);
      }
    }
    return gaps;
  });

type FateParams = { readonly entry: OwnedTable; readonly fate: Fate };

const fateProblems = ({ entry, fate }: FateParams): ReadonlyArray<string> => {
  const { table } = entry;
  const hasWorkspace = entry.columns.includes('workspace_id');
  const workspaceAction = actionOf({ owned: entry, column: 'workspace_id', parent: 'workspaces' });
  const projectAction = actionOf({ owned: entry, column: 'project_id', parent: 'projects' });
  switch (fate) {
    case 'moved':
      return (hasWorkspace && MERGE_SOURCE.includes(`${table} SET workspace_id`)) ||
        MERGE_SOURCE.includes(`INTO ${table}`)
        ? []
        : [`${table} is declared moved but workspace-merge.ts never rewrites it`];
    case 'deleted-by-merge':
      return MERGE_SOURCE.includes(`DELETE FROM ${table} WHERE workspace_id`)
        ? []
        : [`${table} is declared deleted but workspace-merge.ts has no such delete`];
    case 'lost-with-the-source':
      return [
        ...(workspaceAction === 'CASCADE'
          ? []
          : [`${table} is declared lost but its workspace_id does not cascade`]),
        ...(MERGE_SOURCE.includes(`UPDATE ${table}`) || MERGE_SOURCE.includes(`INTO ${table}`)
          ? [`${table} is now handled by workspace-merge.ts: move it out of the lost list`]
          : []),
      ];
    case 'detached':
      return workspaceAction === 'SET NULL'
        ? []
        : [`${table} is declared detached but its workspace_id is not SET NULL`];
    case 'follows-project':
      return !hasWorkspace && projectAction === 'CASCADE'
        ? []
        : [`${table} is declared to follow its project but is not keyed by project_id alone`];
    case 'follows-session':
      return entry.foreignKeys.some(
        (key) => key.table === 'sessions' && key.on_delete === 'CASCADE',
      )
        ? []
        : [`${table} is declared to follow its session but has no cascading session key`];
    default: {
      const exhaustive: never = fate;
      return [exhaustive];
    }
  }
};

describe('workspace ownership across merge and delete', () => {
  it('classifies every table that carries a workspace_id or project_id', async () => {
    const db = await makeMigratedTestDatabase();
    const owned = await ownedTables({ db });
    expect(owned.length).toBeGreaterThan(20);
    expect(
      unclassifiedTables({
        found: owned.map((entry) => entry.table),
        classified: Object.keys(FATES),
      }),
    ).toEqual([]);
  });

  it('keeps no classification for a table that lost its owner column', async () => {
    const db = await makeMigratedTestDatabase();
    const found = (await ownedTables({ db })).map((entry) => entry.table);
    expect(Object.keys(FATES).filter((table) => !found.includes(table))).toEqual([]);
  });

  it('backs every declared fate with what the schema and the merge really do', async () => {
    const db = await makeMigratedTestDatabase();
    const problems = (await ownedTables({ db })).flatMap((entry) => {
      const fate = FATES[entry.table];
      return fate === undefined ? [] : fateProblems({ entry, fate });
    });
    expect(problems).toEqual([]);
  });

  it('lets a workspace delete reach every workspace_id row', async () => {
    const db = await makeMigratedTestDatabase();
    expect(deleteGaps({ owned: await ownedTables({ db }) })).toEqual([]);
  });

  it('fails a new table that carries a workspace_id and no word on merge', async () => {
    const db = await makeMigratedTestDatabase();
    await db.exec('CREATE TABLE fixture_notes (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL)');
    const owned = await ownedTables({ db });
    expect(
      unclassifiedTables({
        found: owned.map((entry) => entry.table),
        classified: Object.keys(FATES),
      }),
    ).toEqual(['fixture_notes']);
    expect(deleteGaps({ owned })).toEqual(['fixture_notes.workspace_id']);
  });

  it('fails a new table keyed by project_id that nobody classified', async () => {
    const db = await makeMigratedTestDatabase();
    await db.exec(
      'CREATE TABLE fixture_marks (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id) ON DELETE CASCADE)',
    );
    const owned = await ownedTables({ db });
    expect(
      unclassifiedTables({
        found: owned.map((entry) => entry.table),
        classified: Object.keys(FATES),
      }),
    ).toEqual(['fixture_marks']);
  });
});
