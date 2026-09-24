import { Button } from '@goodboy/ui';
import { GitPullRequestDraft, RotateCcw, Send, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react';
import type { GitlabMergeRequest, GitlabMrApprovalState } from '../../client';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

export type MrActionBusy = 'draft' | 'close' | 'reopen' | null;

type ApprovalReasonParams = {
  readonly approval: GitlabMrApprovalState | null;
  readonly approvalError: string | null;
  readonly hasApproved: boolean;
};

const approvalBlockReason = ({
  approval,
  approvalError,
  hasApproved,
}: ApprovalReasonParams): string | null => {
  if (approval == null) {
    return approvalError ?? 'Could not load approval status for this merge request.';
  }
  if (hasApproved) {
    return null;
  }
  if (approval.userCanApprove === false) {
    return 'You do not have permission to approve this merge request.';
  }
  return null;
};

type Props = {
  readonly mr: GitlabMergeRequest;
  readonly busy: MrActionBusy;
  readonly approval: GitlabMrApprovalState | null;
  readonly isApprovalBusy: boolean;
  readonly isSupported: boolean;
  readonly approvalError: string | null;
  readonly canAct: boolean;
  readonly onApprove: (() => void) | null;
  readonly onUnapprove: (() => void) | null;
  readonly onToggleDraft: () => void;
  readonly onClose: () => void;
  readonly onReopen: () => void;
};

export const MrActionBar = ({
  mr,
  busy,
  approval,
  isApprovalBusy,
  isSupported,
  approvalError,
  canAct,
  onApprove,
  onUnapprove,
  onToggleDraft,
  onClose,
  onReopen,
}: Props) => {
  const isOpen = mr.state === 'opened';
  const isClosed = mr.state === 'closed';
  const hasApproved = approval?.userHasApproved === true;
  const approveHandler = hasApproved ? onUnapprove : onApprove;
  const isDisabled = busy !== null || !canAct;
  const approvalReason = approvalBlockReason({ approval, approvalError, hasApproved });
  const isApproveBlocked = isDisabled || isApprovalBusy || approvalReason != null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isOpen && isSupported && (
        <Button
          variant={hasApproved ? 'secondary' : 'success'}
          emphasis="outline"
          size="sm"
          aria-disabled={isApproveBlocked}
          title={approvalReason ?? undefined}
          onClick={() => {
            if (isApproveBlocked) {
              return;
            }
            approveHandler?.();
          }}
          isBusy={isApprovalBusy}
          className={isApproveBlocked ? 'opacity-50' : undefined}
        >
          {hasApproved ? (
            <>
              <ThumbsDown size={ICON_SIZE.row} aria-hidden />
              Revoke approval
            </>
          ) : (
            <>
              <ThumbsUp size={ICON_SIZE.row} aria-hidden />
              Approve
            </>
          )}
        </Button>
      )}

      {isOpen && (
        <Button
          variant={mr.draft ? 'success' : 'warning'}
          emphasis="outline"
          size="sm"
          onClick={onToggleDraft}
          disabled={isDisabled}
          isBusy={busy === 'draft'}
        >
          {mr.draft ? (
            <>
              <Send size={ICON_SIZE.row} aria-hidden />
              Mark ready
            </>
          ) : (
            <>
              <GitPullRequestDraft size={ICON_SIZE.row} aria-hidden />
              Convert to draft
            </>
          )}
        </Button>
      )}

      {isOpen && (
        <Button
          variant="danger"
          emphasis="outline"
          size="sm"
          onClick={onClose}
          disabled={isDisabled}
          isBusy={busy === 'close'}
        >
          <XCircle size={ICON_SIZE.row} aria-hidden />
          Close
        </Button>
      )}

      {isClosed && (
        <Button
          variant="success"
          emphasis="outline"
          size="sm"
          onClick={onReopen}
          disabled={isDisabled}
          isBusy={busy === 'reopen'}
        >
          <RotateCcw size={ICON_SIZE.row} aria-hidden />
          Reopen
        </Button>
      )}
    </div>
  );
};
