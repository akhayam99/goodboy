import { useState } from 'react';
import { Button, Divider, InlineConfirm } from '@goodboy/ui';
import {
  GitMerge,
  MessageSquareWarning,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import type { BitbucketPullRequest, BitbucketPullRequestState } from '../../client';
import { bitbucketPrVote } from './bitbucketPrVote';
import { prActionBlockReason } from './prActionBlockReason';
import { voteSummary } from './voteSummary';

export type BitbucketPrActionBusy =
  'approve' | 'unapprove' | 'request-changes' | 'withdraw-changes' | 'merge' | 'decline' | null;

const TERMINAL_NOTE: Record<BitbucketPullRequestState, string> = {
  OPEN: '',
  MERGED:
    'This pull request is merged. Voting, merging and declining are closed on it, comments still go through',
  DECLINED:
    'This pull request was declined. Voting, merging and declining are closed on it, comments still go through',
  SUPERSEDED:
    'Another pull request superseded this one. Voting, merging and declining are closed on it, comments still go through',
};

type Props = {
  readonly pullRequest: BitbucketPullRequest;
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

export const PrActionBar = ({
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
}: Props) => {
  const [confirming, setConfirming] = useState<'merge' | 'decline' | null>(null);
  const isOpen = pullRequest.state === 'OPEN';
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

  return (
    <div className="flex flex-col gap-2">
      <p className="text-2xs text-muted-foreground">
        {voteSummary({ participants: pullRequest.participants, vote })}
      </p>

      {!isOpen && (
        <p className="text-2xs text-muted-foreground">{TERMINAL_NOTE[pullRequest.state]}</p>
      )}

      {isOpen && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={hasApproved ? 'secondary' : 'success'}
            emphasis="outline"
            size="sm"
            aria-disabled={voteReason != null}
            title={
              voteReason ??
              (hasApproved
                ? 'Take your approval back on Bitbucket'
                : 'Record your approval on Bitbucket')
            }
            onClick={() => {
              if (voteReason != null) {
                return;
              }
              const act = hasApproved ? onUnapprove : onApprove;
              act();
            }}
            isBusy={busy === 'approve' || busy === 'unapprove'}
            className={voteReason != null ? 'opacity-50' : undefined}
          >
            {hasApproved ? (
              <>
                <ThumbsDown size={13} aria-hidden />
                Revoke approval
              </>
            ) : (
              <>
                <ThumbsUp size={13} aria-hidden />
                Approve
              </>
            )}
          </Button>

          <Button
            variant={hasRequestedChanges ? 'secondary' : 'warning'}
            emphasis="outline"
            size="sm"
            aria-disabled={voteReason != null}
            title={
              voteReason ??
              (hasRequestedChanges
                ? 'Withdraw the changes you asked for on Bitbucket'
                : 'Tell the author this pull request needs changes')
            }
            onClick={() => {
              if (voteReason != null) {
                return;
              }
              const act = hasRequestedChanges ? onWithdrawChanges : onRequestChanges;
              act();
            }}
            isBusy={busy === 'request-changes' || busy === 'withdraw-changes'}
            className={voteReason != null ? 'opacity-50' : undefined}
          >
            {hasRequestedChanges ? (
              <>
                <RotateCcw size={13} aria-hidden />
                Withdraw request
              </>
            ) : (
              <>
                <MessageSquareWarning size={13} aria-hidden />
                Request changes
              </>
            )}
          </Button>

          <Divider orientation="vertical" className="h-5" />

          {confirming === 'merge' ? (
            <InlineConfirm
              role="danger"
              icon={<GitMerge size={13} aria-hidden />}
              title="Merge this pull request?"
              description="Bitbucket merges it with the strategy the repository is set to. It cannot be undone from here."
              confirmLabel={busy === 'merge' ? 'Merging' : 'Confirm merge'}
              onConfirm={async () => {
                await onMerge();
                setConfirming(null);
              }}
              onCancel={() => setConfirming(null)}
              isBusy={busy === 'merge'}
              isConfirmDisabled={writeReason != null}
              className="w-72"
            />
          ) : (
            <Button
              variant="success"
              emphasis="outline"
              size="sm"
              aria-disabled={writeReason != null}
              title={writeReason ?? 'Merge this pull request on Bitbucket'}
              onClick={() => {
                if (writeReason != null) {
                  return;
                }
                setConfirming('merge');
              }}
              className={writeReason != null ? 'opacity-50' : undefined}
            >
              <GitMerge size={13} aria-hidden />
              Merge
            </Button>
          )}

          {confirming === 'decline' ? (
            <InlineConfirm
              role="danger"
              icon={<XCircle size={13} aria-hidden />}
              title="Decline this pull request?"
              description="Bitbucket closes it without merging. Reopening it is done on Bitbucket."
              confirmLabel={busy === 'decline' ? 'Declining' : 'Confirm decline'}
              onConfirm={async () => {
                await onDecline();
                setConfirming(null);
              }}
              onCancel={() => setConfirming(null)}
              isBusy={busy === 'decline'}
              isConfirmDisabled={writeReason != null}
              className="w-72"
            />
          ) : (
            <Button
              variant="danger"
              emphasis="outline"
              size="sm"
              aria-disabled={writeReason != null}
              title={writeReason ?? 'Close this pull request without merging it'}
              onClick={() => {
                if (writeReason != null) {
                  return;
                }
                setConfirming('decline');
              }}
              className={writeReason != null ? 'opacity-50' : undefined}
            >
              <XCircle size={13} aria-hidden />
              Decline
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
