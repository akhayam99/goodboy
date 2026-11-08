import type { AgentId, ProviderRunId } from '@goodboy/types';
import type { Database, PlainStatement, TransactionOutcome } from '../client';

export const TURN_ADMISSION_HOLD_MS = 120_000;

export const HELD_ADMISSION_SQL = `COALESCE(spawned_at, claimed_at) > ? AND (owner_launch IS NULL OR ? IS NULL OR owner_launch = ?)`;

type HeldParams = {
  readonly launchId: string | null;
  readonly nowMs: number;
};

export const heldAdmissionParams = ({ launchId, nowMs }: HeldParams): ReadonlyArray<unknown> => [
  nowMs - TURN_ADMISSION_HOLD_MS,
  launchId,
  launchId,
];

const HELD_FOR_AGENT_ROW = `EXISTS (
  SELECT 1 FROM turn_admissions held
  WHERE held.agent_id = agents.id AND held.run_id = agents.provider_run_id AND ${HELD_ADMISSION_SQL}
)`;

const STOP_RUNNING = `UPDATE agents SET status = 'stopped', stopped_at = ?, stopped_by = 'app'`;

type RowsAffectedParams = {
  readonly outcome: TransactionOutcome;
  readonly index: number;
};

const rowsAffectedAt = ({ outcome, index }: RowsAffectedParams): number =>
  outcome.status === 'committed' ? (outcome.results[index]?.rowsAffected ?? 0) : 0;

type AdmissionParams = HeldParams & {
  readonly db: Database;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId | null;
};

export const isTurnAdmissionHeld = async ({
  db,
  agentId,
  runId,
  launchId,
  nowMs,
}: AdmissionParams): Promise<boolean> => {
  const rows = await db.select<{ readonly held: number }>(
    `SELECT 1 AS held FROM turn_admissions
     WHERE agent_id = ? AND run_id IS ? AND ${HELD_ADMISSION_SQL}`,
    [agentId, runId, ...heldAdmissionParams({ launchId, nowMs })],
  );
  return rows.length > 0;
};

type ReleaseStatementParams = {
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
};

export const releaseAdmissionStatement = ({
  agentId,
  runId,
}: ReleaseStatementParams): PlainStatement => ({
  sql: 'DELETE FROM turn_admissions WHERE agent_id = ? AND run_id = ?',
  params: [agentId, runId],
});

type ReleaseParams = ReleaseStatementParams & {
  readonly db: Database;
};

export const releaseTurnAdmission = async ({
  db,
  agentId,
  runId,
}: ReleaseParams): Promise<void> => {
  const { sql, params } = releaseAdmissionStatement({ agentId, runId });
  await db.execute(sql, params);
};

export const stopGhostAgent = async ({
  db,
  agentId,
  runId,
  launchId,
  nowMs,
}: AdmissionParams): Promise<boolean> => {
  const held = heldAdmissionParams({ launchId, nowMs });
  const outcome = await db.transaction({
    statements: [
      {
        sql: `DELETE FROM turn_admissions WHERE agent_id = ? AND NOT (${HELD_ADMISSION_SQL})`,
        params: [agentId, ...held],
      },
      {
        sql: `${STOP_RUNNING}
          WHERE id = ? AND status = 'running' AND provider_run_id IS ?
            AND NOT ${HELD_FOR_AGENT_ROW}`,
        params: [nowMs, agentId, runId, ...held],
      },
    ],
  });
  return rowsAffectedAt({ outcome, index: 1 }) > 0;
};

type StopGhostAgentsParams = HeldParams & {
  readonly db: Database;
  readonly keepRunIds: ReadonlyArray<string>;
};

export const stopGhostAgents = async ({
  db,
  keepRunIds,
  launchId,
  nowMs,
}: StopGhostAgentsParams): Promise<number> => {
  const held = heldAdmissionParams({ launchId, nowMs });
  const keep =
    keepRunIds.length === 0
      ? ''
      : ` AND provider_run_id NOT IN (${keepRunIds.map(() => '?').join(', ')})`;
  const outcome = await db.transaction({
    statements: [
      {
        sql: `${STOP_RUNNING}
          WHERE status = 'running' AND provider_run_id IS NOT NULL${keep}
            AND NOT ${HELD_FOR_AGENT_ROW}
            AND NOT EXISTS (
              SELECT 1 FROM turn_events ask
              WHERE ask.agent_id = agents.id
                AND json_extract(ask.payload, '$.kind') = 'permission_request'
                AND json_extract(ask.payload, '$.runId') = agents.provider_run_id
                AND NOT EXISTS (
                  SELECT 1 FROM turn_events decision
                  WHERE decision.agent_id = agents.id
                    AND json_extract(decision.payload, '$.kind') = 'permission_decision'
                    AND json_extract(decision.payload, '$.runId') = agents.provider_run_id
                    AND json_extract(decision.payload, '$.toolUseId') =
                      json_extract(ask.payload, '$.toolUseId')
                )
            )`,
        params: [nowMs, ...keepRunIds, ...held],
      },
      {
        sql: `DELETE FROM turn_admissions WHERE NOT (${HELD_ADMISSION_SQL})`,
        params: [...held],
      },
    ],
  });
  return rowsAffectedAt({ outcome, index: 0 });
};
