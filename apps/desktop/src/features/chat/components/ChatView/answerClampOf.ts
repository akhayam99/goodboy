import type { ProviderRunId } from '@goodboy/types';
import type { ConversationRow } from '../../utils/conversationRows';
import { READING_BUDGETS } from '../../readingOrder/readingBudgets';

type Params = {
  readonly row: ConversationRow;
  readonly activeRunId: ProviderRunId | null;
};

export const answerClampOf = ({ row, activeRunId }: Params): number | null => {
  if (row.kind !== 'item' || row.item.kind !== 'assistant_text') {
    return null;
  }
  const isLive = row.item.runId != null && row.item.runId === activeRunId;
  return isLive ? null : READING_BUDGETS.answerClampLines;
};
