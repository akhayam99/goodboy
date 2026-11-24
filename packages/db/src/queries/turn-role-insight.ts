import type { AgentRole, ProviderName, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

export type TurnEffortCount = Readonly<{
  effort: string | null;
  turns: number;
}>;

export type TurnRoleModel = Readonly<{
  provider: ProviderName;
  model: string;
  turns: number;
  costUsd: number;
  failedTurns: number;
  efforts: ReadonlyArray<TurnEffortCount>;
}>;

export type TurnPickCounts = Readonly<{
  knownTurns: number;
  pinnedTurns: number;
  leadPickTurns: number;
}>;

export type TurnRoleEntry = TurnPickCounts &
  Readonly<{
    role: AgentRole;
    turns: number;
    costUsd: number;
    costPerTurnUsd: number;
    failedTurns: number;
    models: ReadonlyArray<TurnRoleModel>;
    efforts: ReadonlyArray<TurnEffortCount>;
  }>;

export type TurnRoleInsight = TurnPickCounts &
  Readonly<{
    turns: number;
    costUsd: number;
    costPerTurnUsd: number;
    roles: ReadonlyArray<TurnRoleEntry>;
    models: ReadonlyArray<TurnRoleModel>;
    efforts: ReadonlyArray<TurnEffortCount>;
  }>;

export type TurnRoleInsightParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly sinceMs: number | null;
};

type GroupRow = {
  readonly step_role: AgentRole;
  readonly provider: ProviderName;
  readonly model: string;
  readonly effort: string | null;
  readonly turns: number;
  readonly cost_usd: number;
  readonly failed_turns: number;
};

type PickRow = {
  readonly step_role: AgentRole;
  readonly known_turns: number;
  readonly pinned_turns: number;
  readonly lead_turns: number;
};

const PINNED_SOURCES = "('step_lock', 'run_role_lock', 'role_default')";

const PICK_OF_TURN = `CASE
      WHEN a.routing_lock IS NOT NULL THEN 'pinned'
      WHEN json_extract(a.routing_decision, '$.source') IN ${PINNED_SOURCES} THEN 'pinned'
      WHEN d.routing_json IS NOT NULL
        AND COALESCE(json_extract(d.routing_json, '$.proposal'), '') <> 'replaced'
        AND (json_extract(d.routing_json, '$.pick.model') IS NOT NULL
          OR json_extract(d.routing_json, '$.pick.provider') IS NOT NULL
          OR json_extract(d.routing_json, '$.requested.model') IS NOT NULL
          OR json_extract(d.routing_json, '$.requested.provider') IS NOT NULL) THEN 'lead'
      WHEN d.routing_json IS NOT NULL OR a.routing_decision IS NOT NULL THEN 'picked'
    END`;

const selectGroups = ({ db, workspaceId, sinceMs }: TurnRoleInsightParams) =>
  db.select<GroupRow>(
    `SELECT step_role, provider, model, effort,
            COUNT(*) AS turns,
            COALESCE(SUM(cost_usd), 0) AS cost_usd,
            SUM(CASE WHEN end_reason = 'failed' THEN 1 ELSE 0 END) AS failed_turns
       FROM agent_turn_spans
      WHERE workspace_id = ? AND ended_at >= ?
      GROUP BY step_role, provider, model, effort`,
    [workspaceId, sinceMs ?? 0],
  );

const selectPicks = ({ db, workspaceId, sinceMs }: TurnRoleInsightParams) =>
  db.select<PickRow>(
    `WITH turn_picks AS (
       SELECT s.step_role, ${PICK_OF_TURN} AS pick
         FROM agent_turn_spans s
         LEFT JOIN agents a ON a.id = s.agent_id
         LEFT JOIN auto_delegations d ON d.rowid = (
           SELECT latest.rowid FROM auto_delegations latest
            WHERE latest.child_agent_id = s.agent_id
            ORDER BY latest.created_at DESC, latest.rowid DESC
            LIMIT 1
         )
        WHERE s.workspace_id = ? AND s.ended_at >= ?
     )
     SELECT step_role,
            SUM(CASE WHEN pick IS NOT NULL THEN 1 ELSE 0 END) AS known_turns,
            SUM(CASE WHEN pick = 'pinned' THEN 1 ELSE 0 END) AS pinned_turns,
            SUM(CASE WHEN pick = 'lead' THEN 1 ELSE 0 END) AS lead_turns
       FROM turn_picks
      GROUP BY step_role`,
    [workspaceId, sinceMs ?? 0],
  );

type EffortsParams = {
  readonly rows: ReadonlyArray<GroupRow>;
};

const effortsOf = ({ rows }: EffortsParams): ReadonlyArray<TurnEffortCount> => {
  const byEffort = new Map<string | null, number>();
  for (const row of rows) {
    byEffort.set(row.effort, (byEffort.get(row.effort) ?? 0) + row.turns);
  }
  return [...byEffort.entries()]
    .map(([effort, turns]) => ({ effort, turns }))
    .sort((left, right) => right.turns - left.turns);
};

type PerTurnParams = {
  readonly costUsd: number;
  readonly turns: number;
};

const perTurn = ({ costUsd, turns }: PerTurnParams): number => (turns > 0 ? costUsd / turns : 0);

type SumParams = {
  readonly values: ReadonlyArray<number>;
};

const sumOf = ({ values }: SumParams): number => values.reduce((sum, value) => sum + value, 0);

type OrderParams = {
  readonly left: number;
  readonly right: number;
  readonly tie: number;
};

const byTurnsThen = ({ left, right, tie }: OrderParams): number =>
  left === right ? tie : right - left;

type ModelGroup = {
  readonly provider: ProviderName;
  readonly model: string;
  readonly rows: Array<GroupRow>;
};

const modelsOf = ({ rows }: EffortsParams): ReadonlyArray<TurnRoleModel> => {
  const byModel = new Map<string, ModelGroup>();
  for (const row of rows) {
    const key = JSON.stringify([row.provider, row.model]);
    const group = byModel.get(key) ?? { provider: row.provider, model: row.model, rows: [] };
    group.rows.push(row);
    byModel.set(key, group);
  }
  return [...byModel.values()]
    .map((group) => ({
      provider: group.provider,
      model: group.model,
      turns: sumOf({ values: group.rows.map((row) => row.turns) }),
      costUsd: sumOf({ values: group.rows.map((row) => row.cost_usd) }),
      failedTurns: sumOf({ values: group.rows.map((row) => row.failed_turns) }),
      efforts: effortsOf({ rows: group.rows }),
    }))
    .sort((left, right) =>
      byTurnsThen({
        left: left.turns,
        right: right.turns,
        tie: left.model.localeCompare(right.model),
      }),
    );
};

const NO_PICKS: TurnPickCounts = { knownTurns: 0, pinnedTurns: 0, leadPickTurns: 0 };

export const getTurnRoleInsight = async ({
  db,
  workspaceId,
  sinceMs,
}: TurnRoleInsightParams): Promise<TurnRoleInsight> => {
  const [groups, picks] = await Promise.all([
    selectGroups({ db, workspaceId, sinceMs }),
    selectPicks({ db, workspaceId, sinceMs }),
  ]);
  const picksByRole = new Map<AgentRole, TurnPickCounts>(
    picks.map((row) => [
      row.step_role,
      {
        knownTurns: row.known_turns,
        pinnedTurns: row.pinned_turns,
        leadPickTurns: row.lead_turns,
      },
    ]),
  );
  const rowsByRole = new Map<AgentRole, Array<GroupRow>>();
  for (const row of groups) {
    rowsByRole.set(row.step_role, [...(rowsByRole.get(row.step_role) ?? []), row]);
  }
  const roles = [...rowsByRole.entries()]
    .map(([role, rows]): TurnRoleEntry => {
      const turns = sumOf({ values: rows.map((row) => row.turns) });
      const costUsd = sumOf({ values: rows.map((row) => row.cost_usd) });
      return {
        role,
        turns,
        costUsd,
        costPerTurnUsd: perTurn({ costUsd, turns }),
        failedTurns: sumOf({ values: rows.map((row) => row.failed_turns) }),
        models: modelsOf({ rows }),
        efforts: effortsOf({ rows }),
        ...(picksByRole.get(role) ?? NO_PICKS),
      };
    })
    .sort((left, right) =>
      byTurnsThen({
        left: left.turns,
        right: right.turns,
        tie: left.role.localeCompare(right.role),
      }),
    );
  const turns = sumOf({ values: roles.map((role) => role.turns) });
  const costUsd = sumOf({ values: roles.map((role) => role.costUsd) });
  return {
    turns,
    costUsd,
    costPerTurnUsd: perTurn({ costUsd, turns }),
    knownTurns: sumOf({ values: roles.map((role) => role.knownTurns) }),
    pinnedTurns: sumOf({ values: roles.map((role) => role.pinnedTurns) }),
    leadPickTurns: sumOf({ values: roles.map((role) => role.leadPickTurns) }),
    roles,
    models: modelsOf({ rows: groups }),
    efforts: effortsOf({ rows: groups }),
  };
};
