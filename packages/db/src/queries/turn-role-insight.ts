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
  pricedTurns: number;
  costUsd: number | null;
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
    pricedTurns: number;
    costUsd: number | null;
    costPerTurnUsd: number | null;
    failedTurns: number;
    models: ReadonlyArray<TurnRoleModel>;
    efforts: ReadonlyArray<TurnEffortCount>;
  }>;

export type TurnRoleInsight = TurnPickCounts &
  Readonly<{
    turns: number;
    pricedTurns: number;
    costUsd: number | null;
    costPerTurnUsd: number | null;
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
  readonly priced_turns: number;
  readonly cost_usd: number;
  readonly failed_turns: number;
  readonly known_turns: number;
  readonly pinned_turns: number;
  readonly lead_turns: number;
};

const PINNED_SOURCES = "('step_lock', 'run_role_lock', 'role_default')";

const RAN_THE_LOCK = `COALESCE(json_extract(a.routing_lock, '$.pick.provider'), s.provider) = s.provider
        AND COALESCE(json_extract(a.routing_lock, '$.pick.model'), s.model) = s.model`;

const RAN_THE_DECISION = `COALESCE(json_extract(a.routing_decision, '$.selected.provider'), s.provider) = s.provider
        AND COALESCE(json_extract(a.routing_decision, '$.selected.model'), s.model) = s.model`;

const PICK_OF_TURN = `CASE
      WHEN a.routing_lock IS NOT NULL AND ${RAN_THE_LOCK} THEN 'pinned'
      WHEN json_extract(a.routing_decision, '$.source') IN ${PINNED_SOURCES}
        AND ${RAN_THE_DECISION} THEN 'pinned'
      WHEN d.routing_json IS NOT NULL
        AND COALESCE(json_extract(d.routing_json, '$.proposal'), '') <> 'replaced'
        AND (json_extract(d.routing_json, '$.pick.model') IS NOT NULL
          OR json_extract(d.routing_json, '$.pick.provider') IS NOT NULL
          OR json_extract(d.routing_json, '$.requested.model') IS NOT NULL
          OR json_extract(d.routing_json, '$.requested.provider') IS NOT NULL) THEN 'lead'
      WHEN d.routing_json IS NOT NULL OR a.routing_decision IS NOT NULL
        OR a.routing_lock IS NOT NULL THEN 'picked'
    END`;

const selectGroups = ({ db, workspaceId, sinceMs }: TurnRoleInsightParams) =>
  db.select<GroupRow>(
    `WITH turn_picks AS (
       SELECT s.step_role, s.provider, s.model, s.effort, s.cost_usd, s.end_reason,
              ${PICK_OF_TURN} AS pick
         FROM agent_turn_spans s
         LEFT JOIN agents a ON a.id = s.agent_id
         LEFT JOIN auto_delegations d ON d.rowid = (
           SELECT latest.rowid FROM auto_delegations latest
            WHERE latest.child_agent_id = s.agent_id AND latest.created_at <= s.started_at
            ORDER BY latest.created_at DESC, latest.rowid DESC
            LIMIT 1
         )
        WHERE s.workspace_id = ? AND s.ended_at >= ?
     )
     SELECT step_role, provider, model, effort,
            COUNT(*) AS turns,
            COUNT(cost_usd) AS priced_turns,
            COALESCE(SUM(cost_usd), 0) AS cost_usd,
            SUM(CASE WHEN end_reason = 'failed' THEN 1 ELSE 0 END) AS failed_turns,
            SUM(CASE WHEN pick IS NOT NULL THEN 1 ELSE 0 END) AS known_turns,
            SUM(CASE WHEN pick = 'pinned' THEN 1 ELSE 0 END) AS pinned_turns,
            SUM(CASE WHEN pick = 'lead' THEN 1 ELSE 0 END) AS lead_turns
       FROM turn_picks
      GROUP BY step_role, provider, model, effort`,
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

type CostParams = {
  readonly costUsd: number;
  readonly pricedTurns: number;
};

const pricedCostOf = ({ costUsd, pricedTurns }: CostParams): number | null =>
  pricedTurns > 0 ? costUsd : null;

const perTurn = ({ costUsd, pricedTurns }: CostParams): number | null =>
  pricedTurns > 0 ? costUsd / pricedTurns : null;

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
    .map((group) => {
      const pricedTurns = sumOf({ values: group.rows.map((row) => row.priced_turns) });
      const costUsd = sumOf({ values: group.rows.map((row) => row.cost_usd) });
      return {
        provider: group.provider,
        model: group.model,
        turns: sumOf({ values: group.rows.map((row) => row.turns) }),
        pricedTurns,
        costUsd: pricedCostOf({ costUsd, pricedTurns }),
        failedTurns: sumOf({ values: group.rows.map((row) => row.failed_turns) }),
        efforts: effortsOf({ rows: group.rows }),
      };
    })
    .sort((left, right) =>
      byTurnsThen({
        left: left.turns,
        right: right.turns,
        tie: left.model.localeCompare(right.model),
      }),
    );
};

const picksOf = ({ rows }: EffortsParams): TurnPickCounts => ({
  knownTurns: sumOf({ values: rows.map((row) => row.known_turns) }),
  pinnedTurns: sumOf({ values: rows.map((row) => row.pinned_turns) }),
  leadPickTurns: sumOf({ values: rows.map((row) => row.lead_turns) }),
});

export const getTurnRoleInsight = async ({
  db,
  workspaceId,
  sinceMs,
}: TurnRoleInsightParams): Promise<TurnRoleInsight> => {
  const groups = await selectGroups({ db, workspaceId, sinceMs });
  const rowsByRole = new Map<AgentRole, Array<GroupRow>>();
  for (const row of groups) {
    rowsByRole.set(row.step_role, [...(rowsByRole.get(row.step_role) ?? []), row]);
  }
  const roles = [...rowsByRole.entries()]
    .map(([role, rows]): TurnRoleEntry => {
      const pricedTurns = sumOf({ values: rows.map((row) => row.priced_turns) });
      const costUsd = sumOf({ values: rows.map((row) => row.cost_usd) });
      return {
        role,
        turns: sumOf({ values: rows.map((row) => row.turns) }),
        pricedTurns,
        costUsd: pricedCostOf({ costUsd, pricedTurns }),
        costPerTurnUsd: perTurn({ costUsd, pricedTurns }),
        failedTurns: sumOf({ values: rows.map((row) => row.failed_turns) }),
        models: modelsOf({ rows }),
        efforts: effortsOf({ rows }),
        ...picksOf({ rows }),
      };
    })
    .sort((left, right) =>
      byTurnsThen({
        left: left.turns,
        right: right.turns,
        tie: left.role.localeCompare(right.role),
      }),
    );
  const pricedTurns = sumOf({ values: groups.map((row) => row.priced_turns) });
  const costUsd = sumOf({ values: groups.map((row) => row.cost_usd) });
  return {
    turns: sumOf({ values: groups.map((row) => row.turns) }),
    pricedTurns,
    costUsd: pricedCostOf({ costUsd, pricedTurns }),
    costPerTurnUsd: perTurn({ costUsd, pricedTurns }),
    ...picksOf({ rows: groups }),
    roles,
    models: modelsOf({ rows: groups }),
    efforts: effortsOf({ rows: groups }),
  };
};
