import { useMemo } from 'react';
import {
  GitMerge,
  GitPullRequestDraft,
  RotateCcw,
  Send,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import {
  NO_RECORD_VERBS,
  type RecordSecondaryVerbs,
  type RecordVerb,
  type RecordVerbs,
} from '../../../../../../shared/components/StudioDetail/RecordActions/types';
import type { GitlabMergeRequest, GitlabMrApprovalState } from '../../../client';

export type MrVerbBusy = 'merge' | 'draft' | 'close' | 'reopen' | null;

type Params = {
  readonly mr: GitlabMergeRequest | null;
  readonly busy: MrVerbBusy;
  readonly approval: GitlabMrApprovalState | null;
  readonly isApprovalBusy: boolean;
  readonly isSupported: boolean;
  readonly approvalError: string | null;
  readonly canAct: boolean;
  readonly canMerge: boolean;
  readonly onMerge: () => Promise<void>;
  readonly onApprove: (() => void) | null;
  readonly onUnapprove: (() => void) | null;
  readonly onToggleDraft: () => void;
  readonly onClose: () => Promise<void>;
  readonly onReopen: () => void;
};

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

type WriteReasonParams = {
  readonly busy: MrVerbBusy;
  readonly canAct: boolean;
};

const writeBlockReason = ({ busy, canAct }: WriteReasonParams): string | null => {
  if (!canAct) {
    return 'Goodboy cannot reach this merge request on GitLab from here.';
  }
  if (busy !== null) {
    return 'Another change to this merge request is still running.';
  }
  return null;
};

type MergeReasonParams = {
  readonly mr: GitlabMergeRequest;
  readonly canMerge: boolean;
  readonly writeReason: string | null;
};

const mergeBlockReason = ({ mr, canMerge, writeReason }: MergeReasonParams): string | null => {
  if (mr.hasConflicts) {
    return 'This merge request has conflicts. Resolve them before merging.';
  }
  if (mr.mergeStatus === 'cannot_be_merged') {
    return 'GitLab says this merge request cannot be merged yet.';
  }
  if (!canMerge) {
    return 'Goodboy cannot merge this merge request from here.';
  }
  return writeReason;
};

export const useMrVerbs = ({
  mr,
  busy,
  approval,
  isApprovalBusy,
  isSupported,
  approvalError,
  canAct,
  canMerge,
  onMerge,
  onApprove,
  onUnapprove,
  onToggleDraft,
  onClose,
  onReopen,
}: Params): RecordVerbs =>
  useMemo(() => {
    if (mr == null) {
      return NO_RECORD_VERBS;
    }
    const writeReason = writeBlockReason({ busy, canAct });
    if (mr.state === 'closed') {
      const reopen: RecordVerb = {
        key: 'reopen',
        label: 'Reopen',
        icon: RotateCcw,
        onRun: onReopen,
        isBusy: busy === 'reopen',
        blockedReason: busy === 'reopen' ? null : writeReason,
        confirm: null,
      };
      return { secondary: [reopen], overflow: [], destructive: [] };
    }
    if (mr.state !== 'opened') {
      return NO_RECORD_VERBS;
    }
    const hasApproved = approval?.userHasApproved === true;
    const approvalReason =
      writeReason ?? approvalBlockReason({ approval, approvalError, hasApproved });
    const approveHandler = hasApproved ? onUnapprove : onApprove;
    const approve: RecordVerb = {
      key: 'approve',
      label: hasApproved ? 'Revoke approval' : 'Approve',
      icon: hasApproved ? ThumbsDown : ThumbsUp,
      onRun: () => approveHandler?.(),
      isBusy: isApprovalBusy,
      blockedReason: isApprovalBusy ? null : approvalReason,
      confirm: null,
    };
    const merge: RecordVerb = {
      key: 'merge',
      label: 'Merge',
      icon: GitMerge,
      onRun: onMerge,
      isBusy: busy === 'merge',
      blockedReason: busy === 'merge' ? null : mergeBlockReason({ mr, canMerge, writeReason }),
      confirm: {
        title: `Merge !${mr.iid}?`,
        description:
          'GitLab merges it with the method the project is set to. It cannot be undone from here.',
        confirmLabel: 'Confirm merge',
      },
    };
    const secondary: RecordSecondaryVerbs = isSupported ? [approve, merge] : [merge];
    const draft: RecordVerb = {
      key: 'draft',
      label: mr.draft ? 'Mark ready' : 'Convert to draft',
      icon: mr.draft ? Send : GitPullRequestDraft,
      onRun: onToggleDraft,
      isBusy: busy === 'draft',
      blockedReason: busy === 'draft' ? null : writeReason,
      confirm: null,
    };
    const close: RecordVerb = {
      key: 'close',
      label: 'Close merge request',
      icon: XCircle,
      onRun: onClose,
      isBusy: busy === 'close',
      blockedReason: busy === 'close' ? null : writeReason,
      confirm: {
        title: `Close !${mr.iid}?`,
        description: 'GitLab closes it without merging. You can reopen it from here.',
        confirmLabel: 'Confirm close',
      },
    };
    return { secondary, overflow: [draft], destructive: [close] };
  }, [
    mr,
    busy,
    approval,
    isApprovalBusy,
    isSupported,
    approvalError,
    canAct,
    canMerge,
    onMerge,
    onApprove,
    onUnapprove,
    onToggleDraft,
    onClose,
    onReopen,
  ]);
