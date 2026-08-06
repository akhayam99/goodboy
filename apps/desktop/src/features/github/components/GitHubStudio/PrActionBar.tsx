import { useState } from 'react';
import type { PullRequestState } from '@goodboy/types';
import { cn, Divider, InlineConfirm, tintClasses, type Tone } from '@goodboy/ui';
import { GitMerge, GitPullRequestDraft, Plus, RotateCcw, Send, XCircle } from 'lucide-react';
import { PrVerdictAction, type PrVerdictSubmission } from './PrVerdictAction';
import { HOST_ACTION_BUTTON } from '../../../../shared/utils/hostActionButton';

export type ActionBusy = 'ready' | 'undraft' | 'merge' | 'close' | 'reopen' | 'review' | null;

const actionTone = (
  tone: Extract<Tone, 'neutral' | 'success' | 'danger' | 'primary' | 'warning'>,
): string => {
  const t = tintClasses(tone);
  return cn(t.border, t.text, t.hoverBgSoft, t.hoverText);
};

const TONE = {
  neutral: actionTone('neutral'),
  success: actionTone('success'),
  danger: actionTone('danger'),
  primary: actionTone('primary'),
  warning: actionTone('warning'),
} as const;

type Props = {
  readonly pr: PullRequestState;
  readonly busy: ActionBusy;
  readonly canMerge: boolean;
  readonly canReview: boolean;
  readonly mergeReason: string;
  readonly onSubmitVerdict: (submission: PrVerdictSubmission) => void;
  readonly onMarkReady: () => void;
  readonly onConvertDraft: () => void;
  readonly onClose: () => void;
  readonly onReopen: () => void;
  readonly onCreateNew: () => void;
  readonly onMerge: () => Promise<void>;
};

export const PrActionBar = ({
  pr,
  busy,
  canMerge,
  canReview,
  mergeReason,
  onSubmitVerdict,
  onMarkReady,
  onConvertDraft,
  onClose,
  onReopen,
  onCreateNew,
  onMerge,
}: Props) => {
  const [isMergeConfirmOpen, setIsMergeConfirmOpen] = useState(false);
  const isTerminal = pr.state === 'merged' || pr.state === 'closed';
  const isClosed = pr.state === 'closed';
  const isQueued = pr.state === 'queued';
  const isDraft = pr.isDraft;
  const spin = (k: ActionBusy) => busy === k;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!isTerminal && isQueued && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          <GitMerge size={13} aria-hidden />
          {pr.mergeQueue != null ? 'In merge queue' : 'Auto-merge on'}
          {pr.mergeQueue?.position != null && <span>#{pr.mergeQueue.position}</span>}
        </span>
      )}

      {!isTerminal &&
        !isQueued &&
        (isMergeConfirmOpen ? (
          <InlineConfirm
            role="danger"
            icon={<GitMerge size={13} aria-hidden />}
            title="Squash merge this pull request?"
            description="This action cannot be undone."
            confirmLabel={spin('merge') ? 'Merging' : 'Confirm merge'}
            onConfirm={async () => {
              await onMerge();
              setIsMergeConfirmOpen(false);
            }}
            onCancel={() => setIsMergeConfirmOpen(false)}
            isBusy={spin('merge')}
            isConfirmDisabled={canMerge === false || busy !== null}
            className="w-64"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsMergeConfirmOpen(true)}
            disabled={canMerge === false || busy !== null}
            title={mergeReason}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              canMerge
                ? 'border-success bg-success text-success-foreground hover:bg-success/90'
                : 'border-border-soft text-muted-foreground',
            )}
          >
            <GitMerge size={13} aria-hidden />
            Merge
          </button>
        ))}

      {!isTerminal && (
        <PrVerdictAction
          canReview={canReview}
          isBusy={busy !== null}
          isSubmitting={spin('review')}
          onSubmit={onSubmitVerdict}
        />
      )}

      {!isTerminal && <Divider orientation="vertical" className="mx-0.5 h-5" />}

      {!isTerminal && isDraft ? (
        <button
          type="button"
          onClick={onMarkReady}
          disabled={busy !== null}
          className={cn(HOST_ACTION_BUTTON, TONE.success, spin('ready') && 'animate-border-pulse')}
        >
          <Send size={13} aria-hidden />
          Mark ready
        </button>
      ) : !isTerminal ? (
        <button
          type="button"
          onClick={onConvertDraft}
          disabled={busy !== null}
          className={cn(
            HOST_ACTION_BUTTON,
            TONE.warning,
            spin('undraft') && 'animate-border-pulse',
          )}
        >
          <GitPullRequestDraft size={13} aria-hidden />
          Convert to draft
        </button>
      ) : null}

      {!isTerminal && (
        <button
          type="button"
          onClick={onClose}
          disabled={busy !== null}
          className={cn(HOST_ACTION_BUTTON, TONE.danger, spin('close') && 'animate-border-pulse')}
        >
          <XCircle size={13} aria-hidden />
          Close
        </button>
      )}

      {isClosed ? (
        <>
          <button
            type="button"
            onClick={onReopen}
            disabled={busy !== null}
            className={cn(
              HOST_ACTION_BUTTON,
              TONE.success,
              spin('reopen') && 'animate-border-pulse',
            )}
          >
            <RotateCcw size={13} aria-hidden />
            Reopen
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className={cn(HOST_ACTION_BUTTON, TONE.primary)}
          >
            <Plus size={13} aria-hidden />
            Create new PR
          </button>
        </>
      ) : null}
    </div>
  );
};
