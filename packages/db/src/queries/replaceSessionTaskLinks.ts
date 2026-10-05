import type { SessionExternalTask } from '@goodboy/types';
import type { Database, Statement } from '../client';

type Params = {
  readonly db: Database;
  readonly task: SessionExternalTask;
  readonly expected: ReadonlyArray<SessionExternalTask>;
  readonly next: ReadonlyArray<SessionExternalTask>;
};

const IDENTITY_SQL =
  "session_id = ? AND provider = ? AND external_id = ? AND COALESCE(project_id, '') = ?";

type RowParams = {
  readonly task: SessionExternalTask;
};

const values = ({ task }: RowParams): ReadonlyArray<unknown> => [
  task.sessionId,
  task.provider,
  task.externalId,
  task.projectId ?? '',
  task.scope ?? 'session',
  task.branch ?? null,
  task.relation ?? 'closes',
  task.identifier,
  task.url,
  task.title,
  Date.parse(task.createdAt),
];

export const replaceSessionTaskLinks = async ({
  db,
  task,
  expected,
  next,
}: Params): Promise<boolean> => {
  const identity = [task.sessionId, task.provider, task.externalId, task.projectId ?? ''];
  for (const row of [...expected, ...next]) {
    if (
      row.sessionId !== task.sessionId ||
      row.provider !== task.provider ||
      row.externalId !== task.externalId ||
      (row.projectId ?? '') !== (task.projectId ?? '')
    ) {
      throw new Error('A task operation cannot change its identity.');
    }
    if (row.scope === 'branch' && (row.branch === undefined || row.branch === '')) {
      throw new Error('A branch link needs a branch.');
    }
  }
  const statements: ReadonlyArray<Statement> = [
    {
      sql: `SELECT COUNT(*) AS count FROM session_external_tasks WHERE ${IDENTITY_SQL} HAVING COUNT(*) <> ?`,
      params: [...identity, expected.length],
      abortWhen: 'rows',
      abortCode: 'task_changed',
    },
    ...expected.map((row): Statement => ({
      sql: `SELECT 1 FROM session_external_tasks WHERE ${IDENTITY_SQL} AND scope = ? AND branch IS ? AND relation = ? AND identifier = ? AND url = ? AND title = ? AND created_at = ?`,
      params: values({ task: row }),
      abortWhen: 'noRows',
      abortCode: 'task_changed',
    })),
    { sql: `DELETE FROM session_external_tasks WHERE ${IDENTITY_SQL}`, params: identity },
    ...next.map((row): Statement => ({
      sql: `INSERT INTO session_external_tasks (session_id, provider, external_id, project_id, scope, branch, relation, identifier, url, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        row.sessionId,
        row.provider,
        row.externalId,
        row.projectId ?? null,
        ...values({ task: row }).slice(4),
      ],
    })),
  ];
  const outcome = await db.transaction({ statements });
  return outcome.status === 'committed';
};
