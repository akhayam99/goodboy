import type { ProviderRunId } from '@goodboy/types';
import type { ConversationRow } from '../../utils/conversationRows';
import type { TranscriptItem } from '../../utils/transcript-items';

const RUN_BEARING_KINDS = new Set<TranscriptItem['kind']>([
  'decision_note',
  'artifact_capture_failed',
  'error',
  'permission_request',
  'permission_decision',
]);

type RowParams = {
  readonly row: ConversationRow;
};

const rowRunId = ({ row }: RowParams): ProviderRunId | null => {
  if (row.kind !== 'item' || !RUN_BEARING_KINDS.has(row.item.kind)) {
    return null;
  }
  return 'runId' in row.item ? (row.item.runId ?? null) : null;
};

type Params = {
  readonly rows: ReadonlyArray<ConversationRow>;
};

export const lastRowIndexByRun = ({ rows }: Params): ReadonlyMap<ProviderRunId, number> => {
  const byRun = new Map<ProviderRunId, number>();
  rows.forEach((row, index) => {
    const runId = rowRunId({ row });
    if (runId !== null) {
      byRun.set(runId, index);
    }
  });
  return byRun;
};
