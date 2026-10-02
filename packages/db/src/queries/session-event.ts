import type {
  IsoDateTime,
  MaterializationDeferralCause,
  SessionEvent,
  SessionEventId,
  SessionEventKind,
  SessionDecisionChange,
  SessionEventPayload,
  SessionId,
} from '@goodboy/types';
import { MATERIALIZATION_DEFERRAL_CAUSES } from '@goodboy/types';
import type { Database } from '../client';
import { isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

type SessionEventRow = {
  readonly id: string;
  readonly session_id: string;
  readonly kind: string;
  readonly payload_json: string | null;
  readonly created_at: number;
};

type FieldParams = {
  readonly source: Readonly<Record<string, unknown>>;
  readonly key: string;
};

const stringAt = ({ source, key }: FieldParams): string | null => {
  const value = source[key];
  return typeof value === 'string' ? value : null;
};

const numberAt = ({ source, key }: FieldParams): number | null => {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const booleanAt = ({ source, key }: FieldParams): boolean | null => {
  const value = source[key];
  return typeof value === 'boolean' ? value : null;
};

const deferralCauseAt = ({ source, key }: FieldParams): MaterializationDeferralCause | null => {
  const value = stringAt({ source, key });
  return MATERIALIZATION_DEFERRAL_CAUSES.find((candidate) => candidate === value) ?? null;
};

const stringListAt = ({ source, key }: FieldParams): ReadonlyArray<string> | null => {
  const value = source[key];
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
};

const originAt = ({ source, key }: FieldParams): SessionEventPayload['origin'] | null => {
  const value = stringAt({ source, key });
  return value === 'plan' || value === 'rebase' ? value : null;
};

const nullableStringAt = ({ source, key }: FieldParams): string | null | undefined => {
  const value = source[key];
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
};

type DecisionChangeParams = {
  readonly value: unknown;
};

const decisionChangeOf = ({ value }: DecisionChangeParams): SessionDecisionChange | null => {
  if (!isJsonRecord(value)) {
    return null;
  }
  const kind = stringAt({ source: value, key: 'kind' });
  const number = numberAt({ source: value, key: 'number' });
  const text = stringAt({ source: value, key: 'text' });
  if (number === null || text === null) {
    return null;
  }
  const reason = nullableStringAt({ source: value, key: 'reason' });
  switch (kind) {
    case 'added':
    case 'restored':
      return { kind, number, text };
    case 'withdrawn':
      return reason === undefined ? null : { kind, number, text, reason };
    case 'replaced': {
      const by = numberAt({ source: value, key: 'by' });
      return by === null || reason === undefined ? null : { kind, number, by, text, reason };
    }
    case 'merged': {
      const into = numberAt({ source: value, key: 'into' });
      return into === null ? null : { kind, number, into, text };
    }
    case 'reworded': {
      const previousText = stringAt({ source: value, key: 'previousText' });
      return previousText === null ? null : { kind, number, text, previousText };
    }
    default:
      return null;
  }
};

const decisionChangesAt = ({
  source,
  key,
}: FieldParams): ReadonlyArray<SessionDecisionChange> | null => {
  const value = source[key];
  if (!Array.isArray(value)) {
    return null;
  }
  return value.flatMap((item) => {
    const change = decisionChangeOf({ value: item });
    return change === null ? [] : [change];
  });
};

type ParsePayloadParams = {
  readonly raw: string | null;
};

const parsePayload = ({ raw }: ParsePayloadParams): SessionEventPayload | null => {
  if (raw == null || raw.length === 0) {
    return null;
  }
  const source = parseJsonColumn<Readonly<Record<string, unknown>> | null>({
    value: raw,
    isValid: isJsonRecord,
    fallback: null,
  });
  if (source === null) {
    return null;
  }
  const worktreePath = stringAt({ source, key: 'worktreePath' });
  const branch = stringAt({ source, key: 'branch' });
  const from = stringAt({ source, key: 'from' });
  const to = stringAt({ source, key: 'to' });
  const provider = stringAt({ source, key: 'provider' });
  const identifier = stringAt({ source, key: 'identifier' });
  const title = stringAt({ source, key: 'title' });
  const url = stringAt({ source, key: 'url' });
  const workflowName = stringAt({ source, key: 'workflowName' });
  const runId = stringAt({ source, key: 'runId' });
  const projectId = stringAt({ source, key: 'projectId' });
  const mountId = stringAt({ source, key: 'mountId' });
  const host = stringAt({ source, key: 'host' });
  const repository = stringAt({ source, key: 'repository' });
  const projectName = stringAt({ source, key: 'projectName' });
  const reason = stringAt({ source, key: 'reason' });
  const agentId = stringAt({ source, key: 'agentId' });
  const kept = booleanAt({ source, key: 'kept' });
  const externalId = stringAt({ source, key: 'externalId' });
  const number = numberAt({ source, key: 'number' });
  const added = numberAt({ source, key: 'added' });
  const removed = numberAt({ source, key: 'removed' });
  const replaced = numberAt({ source, key: 'replaced' });
  const withdrawn = numberAt({ source, key: 'withdrawn' });
  const merged = numberAt({ source, key: 'merged' });
  const restored = numberAt({ source, key: 'restored' });
  const decisionChanges = decisionChangesAt({ source, key: 'decisionChanges' });
  const consolidatedAfter = stringAt({ source, key: 'consolidatedAfter' });
  const planId = stringAt({ source, key: 'planId' });
  const summary = stringAt({ source, key: 'summary' });
  const origin = originAt({ source, key: 'origin' });
  const files = stringListAt({ source, key: 'files' });
  const isTreeEqual = booleanAt({ source, key: 'isTreeEqual' });
  const prNumber = numberAt({ source, key: 'prNumber' });
  const backupRef = stringAt({ source, key: 'backupRef' });
  const deletedBranchId = stringAt({ source, key: 'deletedBranchId' });
  const onOrigin = booleanAt({ source, key: 'onOrigin' });
  const behind = numberAt({ source, key: 'behind' });
  const turnRunId = stringAt({ source, key: 'turnRunId' });
  const questionId = stringAt({ source, key: 'questionId' });
  const deferralCause = deferralCauseAt({ source, key: 'deferralCause' });
  return {
    ...(worktreePath != null ? { worktreePath } : {}),
    ...(branch != null ? { branch } : {}),
    ...(from != null ? { from } : {}),
    ...(to != null ? { to } : {}),
    ...(provider != null ? { provider } : {}),
    ...(identifier != null ? { identifier } : {}),
    ...(title != null ? { title } : {}),
    ...(url != null ? { url } : {}),
    ...(workflowName != null ? { workflowName } : {}),
    ...(runId != null ? { runId } : {}),
    ...(projectId != null ? { projectId } : {}),
    ...(mountId != null ? { mountId } : {}),
    ...(host != null ? { host } : {}),
    ...(repository != null ? { repository } : {}),
    ...(projectName != null ? { projectName } : {}),
    ...(reason != null ? { reason } : {}),
    ...(agentId != null ? { agentId } : {}),
    ...(kept != null ? { kept } : {}),
    ...(externalId != null ? { externalId } : {}),
    ...(number != null ? { number } : {}),
    ...(added != null ? { added } : {}),
    ...(removed != null ? { removed } : {}),
    ...(replaced != null ? { replaced } : {}),
    ...(withdrawn != null ? { withdrawn } : {}),
    ...(merged != null ? { merged } : {}),
    ...(restored != null ? { restored } : {}),
    ...(decisionChanges != null ? { decisionChanges } : {}),
    ...(consolidatedAfter != null ? { consolidatedAfter } : {}),
    ...(planId != null ? { planId } : {}),
    ...(summary != null ? { summary } : {}),
    ...(origin != null ? { origin } : {}),
    ...(files != null ? { files } : {}),
    ...(isTreeEqual != null ? { isTreeEqual } : {}),
    ...(prNumber != null ? { prNumber } : {}),
    ...(backupRef != null ? { backupRef } : {}),
    ...(deletedBranchId != null ? { deletedBranchId } : {}),
    ...(onOrigin != null ? { onOrigin } : {}),
    ...(behind != null ? { behind } : {}),
    ...(turnRunId != null ? { turnRunId } : {}),
    ...(questionId != null ? { questionId } : {}),
    ...(deferralCause != null ? { deferralCause } : {}),
  };
};

type ToDomainParams = {
  readonly row: SessionEventRow;
};

const toDomain = ({ row }: ToDomainParams): SessionEvent => ({
  id: row.id as SessionEventId,
  sessionId: row.session_id as SessionId,
  kind: row.kind as SessionEventKind,
  payload: parsePayload({ raw: row.payload_json }),
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
});

type InsertParams = {
  readonly db: Database;
  readonly event: SessionEvent;
};

export const insertSessionEvent = async ({ db, event }: InsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_events (id, session_id, kind, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      event.id,
      event.sessionId,
      event.kind,
      event.payload == null ? null : JSON.stringify(event.payload),
      Date.parse(event.createdAt),
    ],
  );
};

type ListParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listSessionEvents = async ({
  db,
  sessionId,
}: ListParams): Promise<ReadonlyArray<SessionEvent>> => {
  const rows = await db.select<SessionEventRow>(
    `SELECT id, session_id, kind, payload_json, created_at
       FROM session_events
      WHERE session_id = ?
      ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return rows.map((row) => toDomain({ row }));
};
