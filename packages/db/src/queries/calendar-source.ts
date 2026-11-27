import {
  brandId,
  CALENDAR_ROLES,
  CALENDAR_SOURCE_KINDS,
  type CalendarRole,
  type CalendarRoleEntry,
  type CalendarSource,
  type CalendarSourceId,
  type CalendarSourceKind,
} from '@goodboy/types';
import type { Database } from '../client';
import { NotFoundError } from '../shared/errors';

type DatabaseParams = {
  readonly db: Database;
};

type SourceRow = {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly host: string | null;
  readonly created_at: number;
};

type RoleRow = {
  readonly source_id: string;
  readonly calendar_id: string;
  readonly role: string;
};

type ValueParams = {
  readonly value: string;
};

const sourceKindOf = ({ value }: ValueParams): CalendarSourceKind | null =>
  CALENDAR_SOURCE_KINDS.find((kind) => kind === value) ?? null;

const roleOf = ({ value }: ValueParams): CalendarRole | null =>
  CALENDAR_ROLES.find((role) => role === value) ?? null;

type SourceRowParams = {
  readonly row: SourceRow;
};

const sourceOf = ({ row }: SourceRowParams): CalendarSource | null => {
  const kind = sourceKindOf({ value: row.kind });
  if (kind === null) {
    return null;
  }
  return {
    id: brandId<CalendarSourceId>({ value: row.id }),
    kind,
    label: row.label,
    host: row.host,
    createdAt: row.created_at,
  };
};

const SOURCE_COLUMNS = 'id, kind, label, host, created_at';

export const listCalendarSources = async ({
  db,
}: DatabaseParams): Promise<ReadonlyArray<CalendarSource>> => {
  const rows = await db.select<SourceRow>(
    `SELECT ${SOURCE_COLUMNS} FROM calendar_sources ORDER BY created_at, id`,
  );
  return rows.flatMap((row) => {
    const source = sourceOf({ row });
    return source === null ? [] : [source];
  });
};

type AddSourceParams = DatabaseParams & {
  readonly source: CalendarSource;
};

export const addCalendarSource = async ({
  db,
  source,
}: AddSourceParams): Promise<CalendarSource> => {
  await db.execute(
    `INSERT INTO calendar_sources (id, kind, label, host, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
    [source.id, source.kind, source.label, source.host, source.createdAt, source.createdAt],
  );
  const rows = await db.select<SourceRow>(
    `SELECT ${SOURCE_COLUMNS} FROM calendar_sources
     WHERE id = ? OR (kind = 'eventkit' AND ? = 'eventkit')
     ORDER BY id = ? DESC LIMIT 1`,
    [source.id, source.kind, source.id],
  );
  const stored = rows[0] === undefined ? null : sourceOf({ row: rows[0] });
  if (stored === null) {
    throw new NotFoundError('calendar_sources', source.id);
  }
  return stored;
};

type SourceParams = DatabaseParams & {
  readonly sourceId: CalendarSourceId;
};

export const removeCalendarSource = async ({ db, sourceId }: SourceParams): Promise<boolean> => {
  const outcome = await db.transaction({
    statements: [
      { sql: 'DELETE FROM calendar_roles WHERE source_id = ?', params: [sourceId] },
      { sql: 'DELETE FROM calendar_sources WHERE id = ?', params: [sourceId] },
    ],
  });
  if (outcome.status !== 'committed') {
    return false;
  }
  return (outcome.results[1]?.rowsAffected ?? 0) > 0;
};

export const listCalendarRoles = async ({
  db,
}: DatabaseParams): Promise<ReadonlyArray<CalendarRoleEntry>> => {
  const rows = await db.select<RoleRow>(
    'SELECT source_id, calendar_id, role FROM calendar_roles ORDER BY source_id, calendar_id',
  );
  return rows.flatMap((row) => {
    const role = roleOf({ value: row.role });
    if (role === null) {
      return [];
    }
    return [
      {
        sourceId: brandId<CalendarSourceId>({ value: row.source_id }),
        calendarId: row.calendar_id,
        role,
      },
    ];
  });
};

type SetRoleParams = DatabaseParams & {
  readonly entry: CalendarRoleEntry;
};

export const setCalendarRole = async ({ db, entry }: SetRoleParams): Promise<boolean> => {
  const writtenAt = Date.now();
  const result = await db.execute(
    `INSERT INTO calendar_roles (id, source_id, calendar_id, role, created_at, updated_at)
     SELECT ?, id, ?, ?, ?, ? FROM calendar_sources WHERE id = ?
     ON CONFLICT (source_id, calendar_id) DO UPDATE SET
       role = excluded.role,
       updated_at = excluded.updated_at`,
    [crypto.randomUUID(), entry.calendarId, entry.role, writtenAt, writtenAt, entry.sourceId],
  );
  return result.rowsAffected > 0;
};
