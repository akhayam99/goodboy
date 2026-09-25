import { useMemo } from 'react';
import {
  GitMerge,
  MessageSquareWarning,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import {
  NO_RECORD_VERBS,
  type RecordVerb,
  type RecordVerbs,
} from '../../../../../shared/components/StudioDetail/RecordActions/types';
import type { BitbucketPullRequest } from '../../client';
import type { BitbucketPrActionBusy } from '../PrDetailPanel/usePrActions';
import { bitbucketPrVote } from './bitbucketPrVote';
import { prActionBlockReason } from './prActionBlockReason';

type Params = {
  readonly pullRequest: BitbucketPullRequest | null;
  readonly accountId: string | null;
  readonly displayName: string | null;
  readonly busy: BitbucketPrActionBusy;
  readonly canAct: boolean;
  readonly onApprove: () => void;
  readonly onUnapprove: () => void;
  readonly onRequestChanges: () => void;
  readonly onWithdrawChanges: () => void;
  readonly onMerge: () => Promise<void>;
  readonly onDecline: () => Promise<void>;
};

export const usePrVerbs = ({
  pullRequest,
  accountId,
  displayName,
  busy,
  canAct,
  onApprove,
  onUnapprove,
  onRequestChanges,
  onWithdrawChanges,
  onMerge,
  onDecline,
}: Params): RecordVerbs =>
  useMemo(() => {
    if (pullRequest == null || pullRequest.state !== 'OPEN') {
      return NO_RECORD_VERBS;
    }
    const vote = bitbucketPrVote({
      participants: pullRequest.participants,
      accountId,
      displayName,
    });
    const isBusy = busy !== null;
    const voteReason = prActionBlockReason({ canAct, isBusy, requiresIdentity: true, vote });
    const writeReason = prActionBlockReason({ canAct, isBusy, requiresIdentity: false, vote });
    const hasApproved = vote === 'approved';
    const hasRequestedChanges = vote === 'changes-requested';
    const isApproving = busy === 'approve' || busy === 'unapprove';
    const isVotingChanges = busy === 'request-changes' || busy === 'withdraw-changes';
    const approve: RecordVerb = {
      key: 'approve',
      label: hasApproved ? 'Revoke approval' : 'Approve',
      icon: hasApproved ? ThumbsDown : ThumbsUp,
      onRun: hasApproved ? onUnapprove : onApprove,
      isBusy: isApproving,
      blockedReason: isApproving ? null : voteReason,
      confirm: null,
    };
    const merge: RecordVerb = {
      key: 'merge',
      label: 'Merge',
      icon: GitMerge,
      onRun: onMerge,
      isBusy: busy === 'merge',
      blockedReason: busy === 'merge' ? null : writeReason,
      confirm: {
        title: 'Merge this pull request?',
        description:
          'Bitbucket merges it with the strategy the repository is set to. It cannot be undone from here.',
        confirmLabel: 'Confirm merge',
      },
    };
    const requestChanges: RecordVerb = {
      key: 'request-changes',
      label: hasRequestedChanges ? 'Withdraw request' : 'Request changes',
      icon: hasRequestedChanges ? RotateCcw : MessageSquareWarning,
      onRun: hasRequestedChanges ? onWithdrawChanges : onRequestChanges,
      isBusy: isVotingChanges,
      blockedReason: isVotingChanges ? null : voteReason,
      confirm: null,
    };
    const decline: RecordVerb = {
      key: 'decline',
      label: 'Decline',
      icon: XCircle,
      onRun: onDecline,
      isBusy: busy === 'decline',
      blockedReason: busy === 'decline' ? null : writeReason,
      confirm: {
        title: 'Decline this pull request?',
        description: 'Bitbucket closes it without merging. Reopening it is done on Bitbucket.',
        confirmLabel: 'Confirm decline',
      },
    };
    return { secondary: [approve, merge], overflow: [requestChanges], destructive: [decline] };
  }, [
    pullRequest,
    accountId,
    displayName,
    busy,
    canAct,
    onApprove,
    onUnapprove,
    onRequestChanges,
    onWithdrawChanges,
    onMerge,
    onDecline,
  ]);
