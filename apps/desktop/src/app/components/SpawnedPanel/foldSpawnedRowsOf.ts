import { runAgentCountOf } from '../../../features/session/runAgentCountOf';
import { helperUrgencyOf, type HelperUrgency } from './helperUrgencyOf';
import { parentIdsOf } from './parentIdsOf';
import type { SpawnedRow } from './spawnedRow';

export type HelpersSummary = Readonly<{
  id: string;
  level: number;
}>;

export type FoldedSpawnedRow = Readonly<{
  row: SpawnedRow;
  count: number;
  isExpanded: boolean;
  isFoldable: boolean;
  urgency: HelperUrgency | null;
  summary: HelpersSummary | null;
}>;

type Params = {
  readonly rows: ReadonlyArray<SpawnedRow>;
  readonly expanded: Readonly<Record<string, boolean>>;
  readonly isOpenByDefault: boolean;
};

type IdParams = {
  readonly id: string;
};

type HelpersParams = {
  readonly rows: ReadonlyArray<SpawnedRow>;
  readonly index: number;
};

export const helpersSummaryIdOf = ({ id }: IdParams): string => `${id}:helpers`;

const helpersOf = ({ rows, index }: HelpersParams): ReadonlyArray<SpawnedRow> => {
  const level = rows[index]?.level ?? 0;
  const helpers: SpawnedRow[] = [];
  for (let next = index + 1; next < rows.length; next += 1) {
    const row = rows[next];
    if (row === undefined || row.level <= level) {
      break;
    }
    helpers.push(row);
  }
  return helpers;
};

export const foldSpawnedRowsOf = ({
  rows,
  expanded,
  isOpenByDefault,
}: Params): ReadonlyArray<FoldedSpawnedRow> => {
  const parentById = parentIdsOf({ nodes: rows });
  const shown: FoldedSpawnedRow[] = [];
  let hiddenUnder: number | null = null;
  for (const [index, row] of rows.entries()) {
    if (hiddenUnder !== null && row.level > hiddenUnder) {
      continue;
    }
    hiddenUnder = null;
    const helpers = helpersOf({ rows, index });
    const count = runAgentCountOf({ agentIds: helpers.map((helper) => helper.agentId) });
    const urgency = helperUrgencyOf({ rows: helpers });
    const isNeedingYou = urgency?.isNeedsYou === true;
    const isRoot = parentById.get(row.id) === null;
    const hasHelpers = count > 0;
    const isExpanded = isRoot
      ? isOpenByDefault || (expanded[row.id] ?? isNeedingYou)
      : (expanded[row.id] ?? (isOpenByDefault || isNeedingYou));
    const isSummarised = isRoot && hasHelpers && !isOpenByDefault;
    shown.push({
      row,
      count,
      isExpanded,
      isFoldable: !isRoot && hasHelpers,
      urgency,
      summary: isSummarised
        ? { id: helpersSummaryIdOf({ id: row.id }), level: row.level + 1 }
        : null,
    });
    if (hasHelpers && !isExpanded) {
      hiddenUnder = row.level;
    }
  }
  return shown;
};
