import type { PullRequestState, SessionId } from '@goodboy/types';
import { cn, Divider } from '@goodboy/ui';
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
const ICON_BTN =
  'inline-flex items-center justify-center rounded-md border border-border-soft p-1.5 text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

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
  readonly mergeConfirm: boolean;
  readonly canMerge: boolean;
  readonly mergeReason: string;
  readonly onMarkReady: () => void;
  readonly onConvertDraft: () => void;
  readonly onClose: () => void;
  readonly onReopen: () => void;
  readonly onCreateNew: () => void;
  readonly onMerge: () => void;
  readonly onSetMergeConfirm: (v: boolean) => void;
  readonly onOpenGithub: () => void;
  readonly onRefresh: () => void;
};

export const PrActionBar = ({
  pr,
  sessionId,
  onOpenSession,
  busy,
  detailLoading,
  mergeConfirm,
  canMerge,
  mergeReason,
  onMarkReady,
  onConvertDraft,
  onClose,
  onReopen,
  onCreateNew,
  onMerge,
  onSetMergeConfirm,
  onOpenGithub,
  onRefresh,
}: Props) => {
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
        <button
          type="button"
          onClick={onOpenGithub}
          title="open on GitHub"
          aria-label="open on GitHub"
          className={ICON_BTN}
        >
          <ExternalLink size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={detailLoading}
          title="refresh"
          aria-label="refresh"
          className={ICON_BTN}
        >
          <RefreshCw size={14} aria-hidden />
        </button>

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
            {mergeConfirm ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs">
                <span className="text-foreground">Squash merge?</span>
                <button
                  type="button"
                  onClick={onMerge}
                  disabled={busy !== null}
                  className={cn(
                    'rounded bg-success px-1.5 py-0.5 text-[11px] font-semibold text-success-foreground hover:opacity-90 disabled:opacity-50',
                    spin('merge') && 'animate-border-pulse',
                  )}
                >
                  {spin('merge') ? 'merging' : 'confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => onSetMergeConfirm(false)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSetMergeConfirm(true)}
                disabled={!canMerge || busy !== null}
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
