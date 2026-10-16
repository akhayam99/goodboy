import type { ConversationRow } from '../../utils/conversationRows';

const WORKFLOW_RAIL_KINDS = new Set(['orchestrator_decision', 'step_transition']);

type Params = {
  row: ConversationRow;
};

export const isWorkflowRailRow = ({ row }: Params): boolean =>
  row.kind === 'item' && WORKFLOW_RAIL_KINDS.has(row.item.kind);
