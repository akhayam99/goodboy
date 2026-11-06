import type {
  InsertionReply,
  TranscriptInsertion,
} from '../../../../shared/types/transcriptInsertion';
import type { ConversationRow } from '../../utils/conversationRows';
import { claimedRepliesOf } from './claimedRepliesOf';
import { rowsByDeliveryOf } from './rowsByDeliveryOf';

type Params = {
  readonly rows: ReadonlyArray<ConversationRow>;
  readonly insertions: ReadonlyArray<TranscriptInsertion>;
};

export type PlacedInsertion = TranscriptInsertion & {
  readonly replies: ReadonlyArray<InsertionReply>;
};

type Placed = Readonly<{
  rows: ReadonlyArray<ConversationRow>;
  insertions: ReadonlyArray<PlacedInsertion>;
}>;

const NO_REPLIES: ReadonlyArray<InsertionReply> = [];

export const placedRowsOf = ({ rows, insertions }: Params): Placed => {
  const delivered = rowsByDeliveryOf({ rows, insertions });
  const claims = claimedRepliesOf({ rows: delivered, insertions });
  return {
    rows: delivered.filter((row) => !claims.claimedKeys.has(row.key)),
    insertions: insertions.map((insertion) => ({
      ...insertion,
      replies: claims.repliesByInsertion.get(insertion.key) ?? NO_REPLIES,
    })),
  };
};
