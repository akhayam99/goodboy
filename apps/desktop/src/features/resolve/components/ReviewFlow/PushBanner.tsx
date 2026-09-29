import { AlertCircle, ArrowUp, Check, GitMerge, RefreshCw, X, type LucideIcon } from 'lucide-react';
import {
  Button,
  GhostActionButton,
  IconButton,
  InlineConfirm,
  WorkNode,
  tintClasses,
  cn,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionReplySettings } from '../../../../store/sessionReplySettings';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SYNC_COPY } from '../../failedRunCopy';
import { blockerCopy, driftSentence, excludedLine } from '../../resolvePublishCopy';
import { pushConfirmBody, pushConfirmTitle, pushStyleNote } from '../../reviewPushCopy';
import type { ReviewPush } from './useReviewPush';

type Props = {
  readonly sessionId: SessionId;
  readonly push: ReviewPush;
};

const RECOVERY_LABEL = {
  open_diff: 'Open diff',
  view_work: 'View the agent',
  recheck_fix: 'Check again',
  sync: SYNC_COPY.action,
} as const;

const RECOVERY_ICON: Record<keyof typeof RECOVERY_LABEL, LucideIcon> = {
  open_diff: CONCEPT_ICONS.diff,
  view_work: CONCEPT_ICONS.agents,
  recheck_fix: RefreshCw,
  sync: GitMerge,
};

export const PUSH_LABEL = 'Push';
export const DISMISS_LABEL = 'Dismiss';

export const PushBanner = ({ sessionId, push }: Props) => {
  const commitStyle = useAppStore((s) => sessionReplySettings({ state: s, sessionId }).commitStyle);
  const { phase } = push;

  if (phase.kind === 'sync_confirm') {
    return (
      <InlineConfirm
        role="primary"
        icon={<GitMerge size={ICON_SIZE.control} aria-hidden />}
        title={SYNC_COPY.confirmTitle}
        description={SYNC_COPY.confirmDescription}
        confirmLabel={SYNC_COPY.confirmLabel}
        onConfirm={push.confirmSync}
        onCancel={push.dismiss}
      />
    );
  }

  if (phase.kind === 'syncing') {
    return (
      <p
        role="status"
        className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-4 py-2.5 text-secondary text-muted-foreground"
      >
        <WorkNode state="running" label={SYNC_COPY.working} mark={{ kind: 'dot' }} />
        {SYNC_COPY.working}
      </p>
    );
  }

  if (phase.kind === 'result') {
    const isDone = phase.result.tone === 'done';
    return (
      <p
        role={isDone ? 'status' : 'alert'}
        className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-4 py-2.5 text-secondary text-foreground"
      >
        {isDone ? (
          <Check
            size={ICON_SIZE.control}
            aria-hidden
            className={cn('shrink-0', tintClasses('success').icon)}
          />
        ) : (
          <AlertCircle
            size={ICON_SIZE.control}
            aria-hidden
            className={cn('shrink-0', tintClasses('danger').icon)}
          />
        )}
        <span className="min-w-0 flex-1">{phase.result.sentence}</span>
        {phase.result.canSync === true && (
          <GhostActionButton icon={GitMerge} label={SYNC_COPY.action} onClick={push.askSync} />
        )}
        <IconButton icon={X} label={DISMISS_LABEL} variant="ghost" onClick={push.dismiss} />
      </p>
    );
  }

  if (phase.kind !== 'confirm' && phase.kind !== 'pushing') {
    return null;
  }

  const { preview } = phase;
  const blocker =
    preview.blocker === null
      ? null
      : blockerCopy({ blocker: preview.blocker, prNumber: preview.prNumber });
  const drift = driftSentence({ drift: preview.drift });
  const excluded = excludedLine({ preview });

  if (blocker !== null || preview.publicationId === null) {
    const recovery =
      blocker?.action ??
      (preview.drift.some((entry) => entry.kind === 'remote_moved') ? ('sync' as const) : null);
    return (
      <div
        role="alert"
        className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-subtle px-4 py-2.5 text-secondary"
      >
        <AlertCircle
          size={ICON_SIZE.control}
          aria-hidden
          className={cn('shrink-0', tintClasses('warning').icon)}
        />
        <span className="min-w-0 flex-1 text-foreground">
          {blocker?.sentence ?? drift ?? 'Nothing can go out yet.'}
        </span>
        {recovery !== null && (
          <GhostActionButton
            icon={RECOVERY_ICON[recovery]}
            label={RECOVERY_LABEL[recovery]}
            onClick={() => push.recover(recovery)}
          />
        )}
        <Button size="sm" variant="ghost" onClick={push.cancel}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <InlineConfirm
      role="primary"
      icon={<ArrowUp size={ICON_SIZE.control} aria-hidden />}
      title={pushConfirmTitle({ preview })}
      description={pushConfirmBody({ preview, commitStyle })}
      confirmLabel={PUSH_LABEL}
      isBusy={phase.kind === 'pushing'}
      onConfirm={push.confirm}
      onCancel={push.cancel}
      note={
        <p className="text-muted-foreground">
          {[drift, excluded, pushStyleNote({ commitStyle })]
            .flatMap((line) => (line === null ? [] : [line.endsWith('.') ? line : `${line}.`]))
            .join(' ')}
        </p>
      }
    />
  );
};
