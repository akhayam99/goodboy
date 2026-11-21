import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

export const WORK_EVENT_KINDS = ['script', 'command', 'check-rerun'] as const;

export type WorkEventKind = (typeof WORK_EVENT_KINDS)[number];

type KindParams = {
  readonly value: string;
};

export const isWorkEventKind = ({ value }: KindParams): boolean =>
  WORK_EVENT_KINDS.some((kind) => kind === value);

const workEventKindOf = ({ value }: KindParams): WorkEventKind | null =>
  WORK_EVENT_KINDS.find((kind) => kind === value) ?? null;

export type WorkEvent = {
  readonly id: string;
  readonly runId: string;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly agentId: AgentId | null;
  readonly kind: WorkEventKind;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly exitCode: number | null;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type ScriptLedgerEntry = {
  readonly scriptId: string;
  readonly runId: string;
  readonly mountId: MountId | null;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly exitCode: number | null;
  readonly runCount: number;
};

type SessionParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

type ListParams = SessionParams & {
  readonly mountId?: MountId;
  readonly limit: number;
};

type EventRow = {
  readonly id: string;
  readonly run_id: string;
  readonly session_id: string;
  readonly mount_id: string | null;
  readonly agent_id: string | null;
  readonly kind: string;
  readonly started_at: number;
  readonly ended_at: number | null;
  readonly exit_code: number | null;
  readonly payload_json: string;
};

type LedgerRow = {
  readonly script_id: string;
  readonly run_id: string;
  readonly mount_id: string | null;
  readonly started_at: number;
  readonly ended_at: number | null;
  readonly exit_code: number | null;
  readonly run_count: number;
};

const EMPTY_PAYLOAD: Readonly<Record<string, unknown>> = {};

type NullableIdParams = {
  readonly value: string | null;
};

type EventParams = {
  readonly row: EventRow;
};

const workEventMountOf = ({ value }: NullableIdParams): MountId | null =>
  value === null ? null : brandId<MountId>({ value });

const eventOf = ({ row }: EventParams): ReadonlyArray<WorkEvent> => {
  const kind = workEventKindOf({ value: row.kind });
  if (kind === null) {
    return [];
  }
  return [
    {
      id: row.id,
      runId: row.run_id,
      sessionId: brandId<SessionId>({ value: row.session_id }),
      mountId: workEventMountOf({ value: row.mount_id }),
      agentId: row.agent_id === null ? null : brandId<AgentId>({ value: row.agent_id }),
      kind,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      exitCode: row.exit_code,
      payload: parseJsonColumn({
        value: row.payload_json,
        isValid: isJsonRecord,
        fallback: EMPTY_PAYLOAD,
      }),
    },
  ];
};

export const listWorkEvents = async ({
  db,
  sessionId,
  mountId,
  limit,
}: ListParams): Promise<ReadonlyArray<WorkEvent>> => {
  const rows = await db.select<EventRow>(
    `SELECT id, run_id, session_id, mount_id, agent_id, kind, started_at, ended_at, exit_code, payload_json
     FROM work_events
     WHERE session_id = ? AND (? IS NULL OR mount_id = ?)
     ORDER BY started_at DESC, run_id DESC
     LIMIT ?`,
    [sessionId, mountId ?? null, mountId ?? null, limit],
  );
  return rows.flatMap((row) => eventOf({ row }));
};

export const listScriptLedger = async ({
  db,
  sessionId,
}: SessionParams): Promise<ReadonlyArray<ScriptLedgerEntry>> => {
  const rows = await db.select<LedgerRow>(
    `SELECT script_id, run_id, mount_id, started_at, ended_at, exit_code, run_count FROM (
       SELECT json_extract(payload_json, '$.scriptId') AS script_id, run_id, mount_id,
         started_at, ended_at, exit_code,
         COUNT(*) OVER (PARTITION BY json_extract(payload_json, '$.scriptId'), mount_id) AS run_count,
         ROW_NUMBER() OVER (
           PARTITION BY json_extract(payload_json, '$.scriptId'), mount_id
           ORDER BY started_at DESC, run_id DESC
         ) AS position
       FROM work_events
       WHERE session_id = ? AND kind = 'script'
     )
     WHERE position = 1 AND typeof(script_id) = 'text'
     ORDER BY started_at DESC, run_id DESC`,
    [sessionId],
  );
  return rows.map((row) => ({
    scriptId: row.script_id,
    runId: row.run_id,
    mountId: workEventMountOf({ value: row.mount_id }),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    exitCode: row.exit_code,
    runCount: row.run_count,
  }));
};
