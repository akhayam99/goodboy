import type {
  InsertionReply,
  TranscriptInsertion,
} from '../../../../shared/types/transcriptInsertion';
import type { ConversationRow } from '../../utils/conversationRows';

type Params = {
  readonly rows: ReadonlyArray<ConversationRow>;
  readonly insertions: ReadonlyArray<TranscriptInsertion>;
};

type Claims = Readonly<{
  claimedKeys: ReadonlySet<string>;
  repliesByInsertion: ReadonlyMap<string, ReadonlyArray<InsertionReply>>;
}>;

type CandidateParams = {
  readonly claimers: ReadonlyArray<TranscriptInsertion>;
  readonly atMs: number;
  readonly text: string;
};

type RankParams = {
  readonly insertion: TranscriptInsertion;
};

const NO_CLAIMS: Claims = { claimedKeys: new Set(), repliesByInsertion: new Map() };

const settleMsOf = ({ insertion }: RankParams): number =>
  insertion.beforeMs ?? Number.POSITIVE_INFINITY;

const candidateOf = ({ claimers, atMs, text }: CandidateParams): TranscriptInsertion | null => {
  let best: TranscriptInsertion | null = null;
  for (const insertion of claimers) {
    const isEligible =
      insertion.claimsReply?.({ text }) === true &&
      (insertion.beforeMs === null || insertion.beforeMs >= atMs);
    if (
      isEligible &&
      (best === null || settleMsOf({ insertion }) < settleMsOf({ insertion: best }))
    ) {
      best = insertion;
    }
  }
  return best;
};

export const claimedRepliesOf = ({ rows, insertions }: Params): Claims => {
  const claimers = insertions.filter((insertion) => insertion.claimsReply !== undefined);
  if (claimers.length === 0) {
    return NO_CLAIMS;
  }
  const claimedKeys = new Set<string>();
  const repliesByInsertion = new Map<string, ReadonlyArray<InsertionReply>>();
  for (const row of rows) {
    if (row.kind !== 'item' || row.item.kind !== 'user_text') {
      continue;
    }
    const { key, text, at } = row.item;
    const insertion = candidateOf({ claimers, atMs: Date.parse(at), text });
    if (insertion === null) {
      continue;
    }
    claimedKeys.add(row.key);
    repliesByInsertion.set(insertion.key, [
      ...(repliesByInsertion.get(insertion.key) ?? []),
      { key, text, at },
    ]);
  }
  return { claimedKeys, repliesByInsertion };
};
