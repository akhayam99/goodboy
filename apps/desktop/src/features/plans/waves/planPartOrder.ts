import { hasWaveGroups, planClusterWaves, type ClusterOrderIssue } from '@goodboy/core/clusters';
import type { ImplementationCluster } from '@goodboy/types';
import type { PlanPartRow } from '../components/PlanParts/planPartRows';
import { partNumbers } from './partNumbers';
import { waveLabel } from './waveLabel';

export type PlanPartWave = Readonly<{
  label: string;
  rows: ReadonlyArray<PlanPartRow>;
}>;

export type SharedPartLine = Readonly<{
  path: string;
  rest: string;
}>;

export type PlanPartOrder = Readonly<{
  waves: ReadonlyArray<PlanPartWave>;
  hasGroups: boolean;
  shared: ReadonlyArray<SharedPartLine>;
  notes: ReadonlyArray<string>;
}>;

type Params = Readonly<{
  rows: ReadonlyArray<PlanPartRow>;
}>;

type IssueParams = Readonly<{
  issue: ClusterOrderIssue;
}>;

const ISSUE_REASON: Readonly<Record<ClusterOrderIssue, string>> = {
  'duplicate-id': 'two parts share an id',
  'unknown-id': "a part waits for one that doesn't exist",
  'self-reference': 'a part waits for itself',
  cycle: 'the parts wait for each other',
};

const issueNote = ({ issue }: IssueParams): string =>
  `The planner's order couldn't be used (${ISSUE_REASON[issue]}), so the parts are ordered by the files they touch.`;

type SoloParams = Readonly<{
  indexes: ReadonlyArray<number>;
}>;

const soloNote = ({ indexes }: SoloParams): string => {
  const subject = partNumbers({ indexes });
  const lead = `${subject.charAt(0).toUpperCase()}${subject.slice(1)}`;
  return indexes.length === 1
    ? `${lead} lists no files, so it runs on its own.`
    : `${lead} list no files, so each runs on its own.`;
};

type RowParams = Readonly<{
  row: PlanPartRow;
}>;

const clusterOf = ({ row }: RowParams): ImplementationCluster => ({
  title: row.title,
  instructions: row.instructions,
  touches: row.touches,
  ...(row.clusterId !== null && { id: row.clusterId }),
  ...(row.after.length > 0 && { after: row.after }),
});

export const planPartOrder = ({ rows }: Params): PlanPartOrder => {
  const plan = planClusterWaves({ clusters: rows.map((row) => clusterOf({ row })) });
  const waves = plan.waves.map((indexes, index) => ({
    label: waveLabel({ index, size: indexes.length }),
    rows: indexes.map((rowIndex) => rows[rowIndex]!),
  }));
  const shared = plan.shared.map(({ path, parts }) => ({
    path,
    rest:
      parts.length === 2
        ? `is shared by ${partNumbers({ indexes: parts })}, so part ${parts[0]! + 1} goes first.`
        : `is shared by ${partNumbers({ indexes: parts })}, so they go in that order.`,
  }));
  const notes = [
    ...(plan.soloIndexes.length === 0 ? [] : [soloNote({ indexes: plan.soloIndexes })]),
    ...(plan.issue === null ? [] : [issueNote({ issue: plan.issue })]),
  ];
  return { waves, hasGroups: hasWaveGroups({ plan }), shared, notes };
};
