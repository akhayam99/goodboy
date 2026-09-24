import type { WorkspaceId } from '@goodboy/types';
import type { Database, GuardedStatement, Statement } from '../client';

type BindingRow = {
  readonly id: string;
  readonly provider: string;
  readonly credential_id: string;
  readonly config: string;
  readonly created_at: number;
  readonly updated_at: number;
};

type MergeParams = {
  readonly db: Database;
  readonly sourceWorkspaceIds: ReadonlyArray<WorkspaceId>;
  readonly targetWorkspaceId: WorkspaceId;
};

type ConfigsMatchParams = {
  readonly left: string;
  readonly right: string;
};

const configsMatch = ({ left, right }: ConfigsMatchParams): boolean => {
  if (left === right) {
    return true;
  }
  try {
    return JSON.stringify(JSON.parse(left)) === JSON.stringify(JSON.parse(right));
  } catch {
    return false;
  }
};

const WORKSPACE_CHANGED = 'WORKSPACE_CHANGED';

const BINDING_COLUMNS = 'id, provider, credential_id, config, created_at, updated_at';

type SourceSnapshot = {
  readonly id: WorkspaceId;
  readonly workspaceBindings: ReadonlyArray<BindingRow>;
  readonly projectIds: ReadonlyArray<string>;
  readonly projectBindingKeys: ReadonlyArray<string>;
};

type MergeSnapshot = {
  readonly targetId: WorkspaceId;
  readonly targetBindings: ReadonlyArray<BindingRow>;
  readonly sources: ReadonlyArray<SourceSnapshot>;
};

type ProjectBindingKeyParams = {
  readonly projectId: string;
  readonly provider: string;
};

const projectBindingKey = ({ projectId, provider }: ProjectBindingKeyParams): string =>
  `${projectId}\u0000${provider}`;

type PlaceholdersParams = {
  readonly values: ReadonlyArray<unknown>;
};

const placeholders = ({ values }: PlaceholdersParams): string => values.map(() => '?').join(', ');

type ChangedGuardParams = {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
  readonly abortWhen: GuardedStatement['abortWhen'];
};

const changedGuard = ({ sql, params, abortWhen }: ChangedGuardParams): GuardedStatement => ({
  sql,
  params,
  abortWhen,
  abortCode: WORKSPACE_CHANGED,
});

type BindingKeyParams = {
  readonly row: BindingRow;
};

const bindingUnchanged = ({ row }: BindingKeyParams): GuardedStatement =>
  changedGuard({
    sql: 'SELECT id FROM integration_bindings WHERE id = ? AND updated_at = ?',
    params: [row.id, row.updated_at],
    abortWhen: 'noRows',
  });

const deleteBinding = ({ row }: BindingKeyParams): GuardedStatement =>
  changedGuard({
    sql: 'DELETE FROM integration_bindings WHERE id = ? AND updated_at = ?',
    params: [row.id, row.updated_at],
    abortWhen: 'noChanges',
  });

type SourceGuardParams = {
  readonly source: SourceSnapshot;
};

const sourceGuards = ({ source }: SourceGuardParams): ReadonlyArray<Statement> => {
  const bindingIds = source.workspaceBindings.map((row) => row.id);
  return [
    changedGuard({
      sql: 'SELECT id FROM workspaces WHERE id = ?',
      params: [source.id],
      abortWhen: 'noRows',
    }),
    changedGuard({
      sql: `SELECT id FROM integration_bindings
       WHERE workspace_id = ? AND project_id IS NULL AND id NOT IN (${placeholders({ values: bindingIds })})`,
      params: [source.id, ...bindingIds],
      abortWhen: 'rows',
    }),
    changedGuard({
      sql: `SELECT id FROM projects WHERE workspace_id = ? AND id NOT IN (${placeholders({ values: source.projectIds })})`,
      params: [source.id, ...source.projectIds],
      abortWhen: 'rows',
    }),
  ];
};

type PlanBindingMergeParams = {
  readonly snapshot: MergeSnapshot;
  readonly newId: () => string;
};

const planBindingMerge = ({
  snapshot,
  newId,
}: PlanBindingMergeParams): ReadonlyArray<Statement> => {
  const targetId = snapshot.targetId;
  const targetByProvider = new Map(snapshot.targetBindings.map((row) => [row.provider, row]));
  const occupied = new Set(snapshot.sources.flatMap((source) => source.projectBindingKeys));
  const statements: Statement[] = [
    changedGuard({
      sql: 'SELECT id FROM workspaces WHERE id = ?',
      params: [targetId],
      abortWhen: 'noRows',
    }),
  ];
  for (const source of snapshot.sources) {
    statements.push(...sourceGuards({ source }));
    statements.push({
      sql: 'UPDATE integration_bindings SET workspace_id = ? WHERE workspace_id = ? AND project_id IS NOT NULL',
      params: [targetId, source.id],
    });
    for (const row of source.workspaceBindings) {
      const targetRow = targetByProvider.get(row.provider);
      if (targetRow === undefined) {
        statements.push(
          changedGuard({
            sql: 'SELECT id FROM integration_bindings WHERE workspace_id = ? AND project_id IS NULL AND provider = ?',
            params: [targetId, row.provider],
            abortWhen: 'rows',
          }),
          changedGuard({
            sql: 'UPDATE integration_bindings SET workspace_id = ? WHERE id = ? AND updated_at = ?',
            params: [targetId, row.id, row.updated_at],
            abortWhen: 'noChanges',
          }),
        );
        targetByProvider.set(row.provider, row);
        continue;
      }
      statements.push(bindingUnchanged({ row: targetRow }));
      const onlyProjectId = source.projectIds.length === 1 ? source.projectIds[0] : undefined;
      if (onlyProjectId !== undefined) {
        const key = projectBindingKey({ projectId: onlyProjectId, provider: row.provider });
        if (occupied.has(key)) {
          statements.push(deleteBinding({ row }));
          continue;
        }
        statements.push(
          changedGuard({
            sql: 'UPDATE integration_bindings SET workspace_id = ?, project_id = ? WHERE id = ? AND updated_at = ?',
            params: [targetId, onlyProjectId, row.id, row.updated_at],
            abortWhen: 'noChanges',
          }),
        );
        occupied.add(key);
        continue;
      }
      if (
        source.projectIds.length > 1 &&
        !configsMatch({ left: row.config, right: targetRow.config })
      ) {
        for (const projectId of source.projectIds) {
          const key = projectBindingKey({ projectId, provider: row.provider });
          if (occupied.has(key)) {
            continue;
          }
          statements.push({
            sql: `INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM integration_bindings
               WHERE workspace_id = ? AND COALESCE(project_id, '') = ? AND provider = ?
             )`,
            params: [
              newId(),
              targetId,
              projectId,
              row.provider,
              row.credential_id,
              row.config,
              row.created_at,
              row.updated_at,
              targetId,
              projectId,
              row.provider,
            ],
          });
          occupied.add(key);
        }
      }
      statements.push(deleteBinding({ row }));
    }
    statements.push(
      {
        sql: 'UPDATE projects SET workspace_id = ? WHERE workspace_id = ?',
        params: [targetId, source.id],
      },
      {
        sql: 'UPDATE sessions SET workspace_id = ? WHERE workspace_id = ?',
        params: [targetId, source.id],
      },
      { sql: 'DELETE FROM workspace_profiles WHERE workspace_id = ?', params: [source.id] },
      {
        sql: 'DELETE FROM settings WHERE key = ?',
        params: [`workspace.${source.id}.branch_prefix`],
      },
      { sql: 'DELETE FROM workspaces WHERE id = ?', params: [source.id] },
    );
  }
  return statements;
};

type ReadWorkspaceParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

const assertWorkspaceExists = async ({ db, workspaceId }: ReadWorkspaceParams): Promise<void> => {
  const rows = await db.select<{ readonly id: string }>('SELECT id FROM workspaces WHERE id = ?', [
    workspaceId,
  ]);
  if (rows.length === 0) {
    throw new Error(`workspace not found: ${workspaceId}`);
  }
};

const readWorkspaceBindings = async ({
  db,
  workspaceId,
}: ReadWorkspaceParams): Promise<ReadonlyArray<BindingRow>> =>
  db.select<BindingRow>(
    `SELECT ${BINDING_COLUMNS} FROM integration_bindings WHERE workspace_id = ? AND project_id IS NULL ORDER BY rowid`,
    [workspaceId],
  );

const readSource = async ({ db, workspaceId }: ReadWorkspaceParams): Promise<SourceSnapshot> => {
  await assertWorkspaceExists({ db, workspaceId });
  const workspaceBindings = await readWorkspaceBindings({ db, workspaceId });
  const projects = await db.select<{ readonly id: string }>(
    'SELECT id FROM projects WHERE workspace_id = ? ORDER BY rowid',
    [workspaceId],
  );
  const projectBindings = await db.select<{
    readonly project_id: string;
    readonly provider: string;
  }>(
    'SELECT project_id, provider FROM integration_bindings WHERE workspace_id = ? AND project_id IS NOT NULL',
    [workspaceId],
  );
  return {
    id: workspaceId,
    workspaceBindings,
    projectIds: projects.map((project) => project.id),
    projectBindingKeys: projectBindings.map((binding) =>
      projectBindingKey({ projectId: binding.project_id, provider: binding.provider }),
    ),
  };
};

export const mergeWorkspaces = async ({
  db,
  sourceWorkspaceIds,
  targetWorkspaceId,
}: MergeParams): Promise<void> => {
  const sourceIds = sourceWorkspaceIds.filter((id) => id !== targetWorkspaceId);
  if (sourceIds.length === 0) {
    return;
  }
  await assertWorkspaceExists({ db, workspaceId: targetWorkspaceId });
  const sources: SourceSnapshot[] = [];
  for (const workspaceId of sourceIds) {
    sources.push(await readSource({ db, workspaceId }));
  }
  const snapshot: MergeSnapshot = {
    targetId: targetWorkspaceId,
    targetBindings: await readWorkspaceBindings({ db, workspaceId: targetWorkspaceId }),
    sources,
  };
  const outcome = await db.transaction({
    statements: planBindingMerge({ snapshot, newId: () => crypto.randomUUID() }),
  });
  if (outcome.status === 'aborted') {
    throw new Error('A workspace changed while it was being merged, so nothing was merged.');
  }
};
