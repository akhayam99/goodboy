import type { ResolvePublicationThread } from '@goodboy/types';

export type PublicationOutcome = Readonly<{
  pushed: boolean;
  pushedHead: string | null;
  total: number;
  replies: number;
  replied: number;
  closed: number;
  resolved: number;
  leftOpen: number;
  failed: number;
  error: string | null;
}>;

type Params = {
  readonly receipts: ReadonlyArray<ResolvePublicationThread>;
  readonly pushedHead: string | null;
};

export const publicationOutcome = ({ receipts, pushedHead }: Params): PublicationOutcome => {
  const closing = receipts.filter((receipt) => receipt.resolvePhase === 'resolved');
  const resolved = closing.filter((receipt) => receipt.resolvedAt !== null).length;
  const failures = receipts.filter((receipt) => receipt.error !== null);
  return {
    pushed: pushedHead !== null,
    pushedHead,
    total: receipts.length,
    replies: receipts.filter((receipt) => receipt.replyBody !== null).length,
    replied: receipts.filter((receipt) => receipt.replyPhase === 'posted').length,
    closed: closing.length,
    resolved,
    leftOpen: closing.length - resolved,
    failed: failures.length,
    error: failures[0]?.error ?? null,
  };
};
