import type { TranscriptRow } from '../../utils/cluster-operations';

const WORKFLOW_RAIL_KINDS = new Set([
  'workflow_kickoff',
  'orchestrator_decision',
  'step_transition',
]);

type Params = {
  row: TranscriptRow;
};

export const isWorkflowRailRow = ({ row }: Params): boolean =>
  row.kind === 'item' && WORKFLOW_RAIL_KINDS.has(row.item.kind);
