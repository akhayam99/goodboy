import { CircleAlert, ArrowUp, Check, GitMerge, X, type LucideIcon } from 'lucide-react';
import {
  Button,
  Chip,
  cn,
  FOCUS_RING,
  GhostActionButton,
  ICON_SIZE,
  IconButton,
  InlineConfirm,
  tintClasses,
  WorkNode,
} from '@goodboy/ui';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  selectMountById,
  selectWritableMounts,
} from '../../../../store/slices/project-mounts/selectors';
import { sessionReplySettings } from '../../../../store/sessionReplySettings';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { PushFailureCard } from './PushFailureCard';
import { PushFixIdle } from './PushFixIdle';
import { SYNC_COPY } from '../../failedRunCopy';
import { blockerCopy, driftSentence, excludedLine } from '../../resolvePublishCopy';
import { useActiveReviewSource } from '../../hooks/useActiveReviewSource';
import { pushConfirmBody, pushConfirmTitle, pushStyleNote } from '../../reviewPushCopy';
import type { ReviewPush } from './useReviewPush';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
  readonly push: ReviewPush;
};

const RECOVERY_LABEL = {
  open_diff: `Open ${NAMES.files}`,
  view_work: 'View the agent',
  see_missing: 'See the comment',
  sync: SYNC_COPY.action,
} as const;

const RECOVERY_ICON: Record<keyof typeof RECOVERY_LABEL, LucideIcon> = {
  open_diff: CONCEPT_ICONS.diff,
  view_work: CONCEPT_ICONS.agents,
  see_missing: CONCEPT_ICONS.review,
  sync: GitMerge,
};

const BANNER_SURFACE = 'rounded-lg bg-subtle';
const PUSH_LABEL = 'Push';
const DISMISS_LABEL = 'Dismiss';
const NOT_A_FIX_LABEL = 'Not a fix';

export const PushBanner = ({ sessionId, mountId = null, push }: Props) => {
  const commitStyle = useAppStore((s) => sessionReplySettings({ state: s, sessionId }).commitStyle);
  const { phase } = push;
  const { source } = useActiveReviewSource({ sessionId, mountId });
  const repoName = useAppStore((s) =>
    mountId === null || selectWritableMounts({ state: s, sessionId }).length < 2
      ? null
      : (selectMountById({ state: s, sessionId, mountId })?.mountName ?? null),
  );
  const provider = REVIEW_SOURCE_LABEL[source?.kind ?? 'github'];

  if (phase.kind === 'idle') {
    return <PushFixIdle sessionId={sessionId} mountId={mountId} onSettled={push.retryAfterFix} />;
  }

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
        className={BANNER_SURFACE}
      />
    );
  }

  if (phase.kind === 'syncing') {
    return (
      <p
        role="status"
        className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-muted-foreground"
      >
        <WorkNode state="running" label={SYNC_COPY.working} mark={{ kind: 'dot' }} />
        {SYNC_COPY.working}
      </p>
    );
  }

  if (phase.kind === 'result' && phase.result.failure !== undefined) {
    return <PushFailureCard sessionId={sessionId} push={push} result={phase.result} />;
  }

  if (phase.kind === 'result') {
    const isDone = phase.result.tone === 'done';
    return (
      <p
        role={isDone ? 'status' : 'alert'}
        className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-foreground"
      >
        {isDone ? (
          <Check
            size={ICON_SIZE.control}
            aria-hidden
            className={cn('shrink-0', tintClasses('success').icon)}
          />
        ) : (
          <CircleAlert
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
  if (phase.kind === 'pushing' && !phase.hasPanel) {
    return null;
  }

  const { preview } = phase;
  const blocker =
    preview.blocker === null
      ? null
      : blockerCopy({ blocker: preview.blocker, prNumber: preview.prNumber });
  const drift = driftSentence({ drift: preview.drift });
  const excluded = excludedLine({ preview });
  const earlier = preview.earlierCommits ?? [];

  if (blocker !== null || preview.publicationId === null) {
    const recovery =
      blocker?.action ??
      (preview.drift.some((entry) => entry.kind === 'remote_moved') ? ('sync' as const) : null);
    return (
      <div
        role="alert"
        className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-subtle px-4 py-2 text-meta"
      >
        <CircleAlert
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

  const styleNote = pushStyleNote({ commitStyle });
  const changed = phase.kind === 'confirm' ? phase.changed : undefined;

  const confirmBar = (
    <InlineConfirm
      role="primary"
      icon={<ArrowUp size={ICON_SIZE.control} aria-hidden />}
      title={pushConfirmTitle({ preview, repoName })}
      description={pushConfirmBody({
        preview,
        commitStyle,
        provider,
        canResolve: source?.capabilities.canResolve ?? true,
      })}
      confirmLabel={PUSH_LABEL}
      isBusy={phase.kind === 'pushing'}
      onConfirm={push.confirm}
      onCancel={push.cancel}
      className={BANNER_SURFACE}
      note={
        <div className="flex min-w-0 flex-col gap-2">
          <ul className="flex min-w-0 flex-col">
            {[
              ...earlier.map((commit) => ({ commit, isFix: false })),
              ...preview.commits.map((commit) => ({ commit, isFix: true })),
            ].map(({ commit, isFix }) => (
              <li
                key={commit.sha}
                className="flex min-w-0 items-center gap-2 text-muted-foreground"
              >
                <span className="shrink-0 font-mono">{commit.shortSha}</span>
                <span className="min-w-0 flex-1 truncate">{commit.subject}</span>
                {!isFix && (
                  <Chip
                    kind="state"
                    tone="neutral"
                    bordered={false}
                    emphasis="subtle"
                    label={NOT_A_FIX_LABEL}
                    className="shrink-0"
                  />
                )}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            {[changed === undefined ? drift : null, excluded]
              .flatMap((line) => (line === null ? [] : [line.endsWith('.') ? line : `${line}.`]))
              .join(' ')}{' '}
            {styleNote.text}{' '}
            <button
              type="button"
              onClick={styleNote.onOpen}
              className={cn(
                'rounded-sm text-foreground underline-offset-2 hover:underline',
                FOCUS_RING,
              )}
            >
              {styleNote.linkLabel}
            </button>
            .
          </p>
        </div>
      }
    />
  );

  if (changed === undefined) {
    return confirmBar;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p
        role="status"
        className="flex min-w-0 items-center gap-2 px-1 text-meta text-muted-foreground"
      >
        <CircleAlert
          size={ICON_SIZE.control}
          aria-hidden
          className={cn('shrink-0', tintClasses('warning').icon)}
        />
        {changed.endsWith('.') ? changed : `${changed}.`}
      </p>
      {confirmBar}
    </div>
  );
};
