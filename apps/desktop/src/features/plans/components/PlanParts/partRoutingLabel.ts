import { EFFORT_LABEL, modelLabel } from '../../../chat/utils/chat-constants';
import type { PlanPartRow } from './planPartRows';

export const partRoutingLabel = ({ row }: { readonly row: PlanPartRow }): string => {
  if (row.model === null) {
    return 'Default model';
  }
  const model = modelLabel(row.model);
  return row.effort === null ? model : `${model} · ${EFFORT_LABEL[row.effort]}`;
};
