import { cn, tintClasses, type Tone } from '@goodboy/ui';
import { GitPullRequestDraft, RotateCcw, Send, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react';
import type { GitlabMergeRequest, GitlabMrApprovalState } from '../../client';
import { MR_ACTION_BUTTON } from './mrActionButton';

export type MrActionBusy = 'draft' | 'close' | 'reopen' | null;

type ToneParams = {
  readonly tone: Extract<Tone, 'neutral' | 'success' | 'danger' | 'warning'>;
};

const actionTone = ({ tone }: ToneParams): string => {
  const t = tintClasses(tone);
  return cn(t.border, t.text, t.hoverBgSoft, t.hoverText);
};

const TONE = {
  neutral: actionTone({ tone: 'neutral' }),
  success: actionTone({ tone: 'success' }),
  danger: actionTone({ tone: 'danger' }),
  warning: actionTone({ tone: 'warning' }),
} as const;

type Props = {
  readonly mr: GitlabMergeRequest;
  readonly busy: MrActionBusy;
  readonly approval: GitlabMrApprovalState | null;
  readonly isApprovalBusy: boolean;
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

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isOpen && approval != null && approveHandler != null && (
        <button
          type="button"
          onClick={approveHandler}
          disabled={isDisabled || isApprovalBusy}
          className={cn(
            MR_ACTION_BUTTON,
            hasApproved ? TONE.neutral : TONE.success,
            isApprovalBusy && 'animate-border-pulse',
          )}
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
        </button>
      )}

      {isOpen && (
        <button
          type="button"
          onClick={onToggleDraft}
          disabled={isDisabled}
          className={cn(
            MR_ACTION_BUTTON,
            mr.draft ? TONE.success : TONE.warning,
            busy === 'draft' && 'animate-border-pulse',
          )}
        >
          {mr.draft ? (
            <>
              <Send size={13} aria-hidden />
              Mark ready
            </>
          ) : (
            <>
              <GitPullRequestDraft size={13} aria-hidden />
              Convert to draft
            </>
          )}
        </button>
      )}

      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          disabled={isDisabled}
          className={cn(MR_ACTION_BUTTON, TONE.danger, busy === 'close' && 'animate-border-pulse')}
        >
          <XCircle size={13} aria-hidden />
          Close
        </button>
      )}

      {isClosed && (
        <button
          type="button"
          onClick={onReopen}
          disabled={isDisabled}
          className={cn(
            MR_ACTION_BUTTON,
            TONE.success,
            busy === 'reopen' && 'animate-border-pulse',
          )}
        >
          <RotateCcw size={13} aria-hidden />
          Reopen
        </button>
      )}
    </div>
  );
};
