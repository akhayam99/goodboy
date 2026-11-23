import { AGENT_KIND_META } from '../../session/agent-kind';
import type { RunningGroup, RunningRow } from './runningGroupsOf';

type Params = {
  readonly groups: ReadonlyArray<RunningGroup>;
};

type PickParams = {
  readonly rows: ReadonlyArray<RunningRow>;
};

const IMPLEMENTER = AGENT_KIND_META.implementer.noun;

const chipRowOf = ({ rows }: PickParams): RunningRow | undefined =>
  rows.find((row) => row.who === IMPLEMENTER) ?? rows[0];

export const overlapRunIdsOf = ({ groups }: Params): ReadonlySet<string> => {
  const byMount = new Map<string, RunningRow[]>();
  for (const row of groups.flatMap((group) => group.rows)) {
    if (row.mountId === null) {
      continue;
    }
    byMount.set(row.mountId, [...(byMount.get(row.mountId) ?? []), row]);
  }
  return new Set(
    [...byMount.values()].flatMap((rows) => {
      const row = chipRowOf({ rows });
      return row === undefined ? [] : [row.runId];
    }),
  );
};
