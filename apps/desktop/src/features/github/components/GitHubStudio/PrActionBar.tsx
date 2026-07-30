import { useState } from 'react';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { cn, Divider, IconButton, InlineConfirm } from '@goodboy/ui';
import {
  ExternalLink,
  GitMerge,
  GitPullRequestDraft,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';

export type ActionBusy = 'ready' | 'undraft' | 'merge' | 'close' | 'reopen' | null;

const BTN =
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const TONE = {
  neutral:
    'border-border-soft text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
  success: 'border-success/40 text-success hover:bg-success/10',
  danger: 'border-danger/40 text-danger hover:bg-danger/10',
  primary: 'border-primary/40 text-primary hover:bg-primary/10',
  warning: 'border-warning/40 text-warning hover:bg-warning/10',
} as const;

type Props = {
  readonly pr: PullRequestState;
  readonly sessionId: SessionId;
  readonly onOpenSession: () => void;
  readonly busy: ActionBusy;
  readonly detailLoading: boolean;
  readonly canMerge: boolean;
  readonly mergeReason: string;
  readonly onMarkReady: () => void;
  readonly onConvertDraft: () => void;
  readonly onClose: () => void;
  readonly onReopen: () => void;
  readonly onCreateNew: () => void;
  readonly onMerge: () => Promise<void>;
  readonly onOpenGithub: () => void;
  readonly onRefresh: () => void;
};

export const PrActionBar = ({
  pr,
  sessionId,
  onOpenSession,
  busy,
  detailLoading,
  canMerge,
  mergeReason,
  onMarkReady,
  onConvertDraft,
  onClose,
  onReopen,
  onCreateNew,
  onMerge,
  onOpenGithub,
  onRefresh,
}: Props) => {
  const [isMergeConfirmOpen, setIsMergeConfirmOpen] = useState(false);
  const isTerminal = pr.state === 'merged' || pr.state === 'closed';
  const isClosed = pr.state === 'closed';
  const isQueued = pr.state === 'queued';
  const isDraft = pr.isDraft;
  const spin = (k: ActionBusy) => busy === k;

  return (
    <div className="flex shrink-0 items-center gap-1.5 px-6 py-3">
      {!isTerminal && isDraft ? (
        <button
          type="button"
          onClick={onMarkReady}
          disabled={busy !== null}
          className={cn(BTN, TONE.success, spin('ready') && 'animate-border-pulse')}
        >
          <Send size={13} aria-hidden />
          Mark ready
        </button>
      ) : !isTerminal ? (
        <button
          type="button"
          onClick={onConvertDraft}
          disabled={busy !== null}
          className={cn(BTN, TONE.warning, spin('undraft') && 'animate-border-pulse')}
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
          className={cn(BTN, TONE.danger, spin('close') && 'animate-border-pulse')}
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
            className={cn(BTN, TONE.success, spin('reopen') && 'animate-border-pulse')}
          >
            <RotateCcw size={13} aria-hidden />
            Reopen
          </button>
          <button type="button" onClick={onCreateNew} className={cn(BTN, TONE.primary)}>
            <Plus size={13} aria-hidden />
            Create new PR
          </button>
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5">
        <OpenSessionButton sessionId={sessionId} onOpened={onOpenSession} variant="ghost" />
        <IconButton
          icon={ExternalLink}
          iconSize={14}
          label="open on GitHub"
          onClick={onOpenGithub}
        />
        <IconButton
          icon={RefreshCw}
          iconSize={14}
          label="refresh"
          onClick={onRefresh}
          disabled={detailLoading}
          busy={detailLoading}
        />

        {!isTerminal && isQueued && (
          <>
            <Divider orientation="vertical" className="mx-0.5 h-5" />
            <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <GitMerge size={13} aria-hidden />
              In merge queue
              {pr.mergeQueue?.position != null && <span>#{pr.mergeQueue.position}</span>}
            </span>
          </>
        )}

        {!isTerminal && !isQueued && (
          <>
            <Divider orientation="vertical" className="mx-0.5 h-5" />
            {isMergeConfirmOpen ? (
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
            )}
          </>
        )}
      </div>
    </div>
  );
};
