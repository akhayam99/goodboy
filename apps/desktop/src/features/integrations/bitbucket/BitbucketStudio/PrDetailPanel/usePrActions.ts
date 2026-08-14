import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useToast } from '../../../../../app/components/Toast';
import { useAppStore } from '../../../../../store';
import type { BitbucketPrWriteParams } from '../../../../../store/slices/bitbucket-pr';
import type { BitbucketRepo } from '../../client';
import type { BitbucketPrActionBusy } from '../PrActionBar';

type Params = {
  readonly sessionId: SessionId | null;
  readonly repo: BitbucketRepo | null;
  readonly pullRequestId: number | null;
  readonly onWritten: () => void;
};

type ReplyParams = {
  readonly parentCommentId: number;
  readonly body: string;
};

type Result = Readonly<{
  busy: BitbucketPrActionBusy;
  canAct: boolean;
  approve: () => void;
  unapprove: () => void;
  requestChanges: () => void;
  withdrawChanges: () => void;
  merge: () => Promise<void>;
  decline: () => Promise<void>;
  comment: ((body: string) => Promise<void>) | null;
  reply: ((params: ReplyParams) => Promise<void>) | null;
}>;

type RunParams = {
  readonly kind: Exclude<BitbucketPrActionBusy, null>;
  readonly toast: string;
  readonly act: (target: BitbucketPrWriteParams) => Promise<void>;
};

export const usePrActions = ({ sessionId, repo, pullRequestId, onWritten }: Params): Result => {
  const approveBitbucketPr = useAppStore((state) => state.approveBitbucketPr);
  const unapproveBitbucketPr = useAppStore((state) => state.unapproveBitbucketPr);
  const requestBitbucketPrChanges = useAppStore((state) => state.requestBitbucketPrChanges);
  const withdrawBitbucketPrChanges = useAppStore((state) => state.withdrawBitbucketPrChanges);
  const mergeBitbucketPr = useAppStore((state) => state.mergeBitbucketPr);
  const declineBitbucketPr = useAppStore((state) => state.declineBitbucketPr);
  const commentOnBitbucketPr = useAppStore((state) => state.commentOnBitbucketPr);
  const replyToBitbucketPrComment = useAppStore((state) => state.replyToBitbucketPrComment);
  const { showToast } = useToast();
  const [busy, setBusy] = useState<BitbucketPrActionBusy>(null);

  const target =
    sessionId == null || repo == null || pullRequestId == null
      ? null
      : { sessionId, repo, pullRequestId };

  const run = async ({ kind, toast, act }: RunParams) => {
    if (target == null || busy !== null) {
      return;
    }
    setBusy(kind);
    try {
      await act(target);
      onWritten();
      showToast('success', toast);
    } catch (error: unknown) {
      showToast('error', formatError(error));
    } finally {
      setBusy(null);
    }
  };

  return {
    busy,
    canAct: target != null,
    approve: () =>
      void run({
        kind: 'approve',
        toast: 'Approval recorded on Bitbucket',
        act: approveBitbucketPr,
      }),
    unapprove: () =>
      void run({
        kind: 'unapprove',
        toast: 'Approval withdrawn on Bitbucket',
        act: unapproveBitbucketPr,
      }),
    requestChanges: () =>
      void run({
        kind: 'request-changes',
        toast: 'Changes requested on Bitbucket',
        act: requestBitbucketPrChanges,
      }),
    withdrawChanges: () =>
      void run({
        kind: 'withdraw-changes',
        toast: 'Change request withdrawn on Bitbucket',
        act: withdrawBitbucketPrChanges,
      }),
    merge: () =>
      run({ kind: 'merge', toast: 'Pull request merged on Bitbucket', act: mergeBitbucketPr }),
    decline: () =>
      run({
        kind: 'decline',
        toast: 'Pull request declined on Bitbucket',
        act: declineBitbucketPr,
      }),
    comment:
      target == null
        ? null
        : async (body: string) => {
            await commentOnBitbucketPr({ ...target, body });
            onWritten();
          },
    reply:
      target == null
        ? null
        : async ({ parentCommentId, body }: ReplyParams) => {
            await replyToBitbucketPrComment({ ...target, parentCommentId, body });
            onWritten();
          },
  };
};
