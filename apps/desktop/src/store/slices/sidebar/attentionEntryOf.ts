import type { WorkspaceAttentionRow } from '../../../features/workflows/workflows';
import { ATTENTION_REASON_META } from '../../../features/session/session-stage';
import type { WorkspaceAttentionEntry } from './state';

type Params = {
  readonly row: WorkspaceAttentionRow;
};

type ReasonParams = {
  readonly reason: string;
};

const reasonWordsOf = ({ reason }: ReasonParams): ReadonlyArray<string> =>
  Object.entries(ATTENTION_REASON_META)
    .filter(([known]) => known === reason)
    .map(([, entry]) => entry.words);

export const attentionEntryOf = ({ row }: Params): WorkspaceAttentionEntry => ({
  count: row.count,
  tone: row.tone,
  reasonWords: row.reasons.flatMap((reason) => reasonWordsOf({ reason })),
});
