import { useMemo, useState, type ReactNode } from 'react';
import { Check, CircleCheck } from 'lucide-react';
import { REVIEW_SOURCE_CAPABILITIES, REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { Chip, ICON_SIZE, Markdown, SectionHeader, Tooltip, FOCUS_RING, cn } from '@goodboy/ui';
import { useThreadQuestion } from '../../hooks/useThreadQuestion';
import { CommentComposer } from '../../../../shared/components/CommentComposer';
import type { ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

import {
  PARTIAL_ACCEPTANCE,
  PARTIAL_REFUSAL,
} from '../../../../store/slices/resolve/acceptResolveQueueItem';
import type { ResolveCandidateWithItems } from '../../../../store/slices/resolve/state';
import { useActionEnv } from '../../../actions/useActionEnv';
import { landingLiveKey } from '../../../chat/reveal/landingLiveKey';
import { useFreshLanding } from '../../../chat/reveal/useFreshLanding';
import { useObjectActions } from '../../../actions/useObjectActions';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { attemptNumberOf, previousAttemptsOf } from '../../attemptHistory';
import { conversationSha } from '../../conversationAgentResult';
import { FAILED_RUN_COPY, tryAgainLabel } from '../../failedRunCopy';
import type { ReviewCommentBinding, ReviewCompose } from '../../hooks/useReviewCommentController';
import { useResolveCandidateDiff } from '../../hooks/useResolveCandidateDiff';
import { useResolveItemDraft } from '../../hooks/useResolveItemDraft';
import { isResolveOnly } from '../../reviewCommentState';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import {
  COMPOSE_COPY,
  FIX_RUN_QUESTION_COPY,
  REVIEW_FLOW_LABEL,
  composePlaceholder,
  decidedNote,
  replyHeading,
  sharedFixLine,
} from '../../reviewFlowCopy';
import { selectResolveCandidate } from '../../selectResolveCandidate';
import { handledByLine } from '../../../../store/slices/resolve/threadGitState';
import { foldedReply, verdictReply } from '../../commentVerdict';
import { sharedCandidateBlocker, sharedCandidateThreadIds } from '../../sharedCandidateThreadIds';
import { ReviewerCommentBlock } from './ReviewerCommentBlock';
import { ResolverQuestionCard } from '../../ResolverQuestionCard';
import { WorkingRun } from './WorkingRun';
import { AgentLine } from './AgentLine';
import { FailedRun } from './FailedRun';
import { PreviousAttempts } from './PreviousAttempts';
import { ProposedChange } from './ProposedChange';
import { ThreadGitEvidence } from './ThreadGitEvidence';
import { NewReplyNote } from './NewReplyNote';
import { ReplyNote } from './ReplyNote';
import { PushFailedNote } from './PushFailedNote';
import { replyNoteKindOf } from './replyNoteKind';
import { SourceChangeCard } from './SourceChangeCard';
import { ThreadRecheckLine } from './ThreadRecheckLine';
import { ThreadVerdictCard } from './ThreadVerdictCard';
import type { ReviewEntry } from './useReviewEntries';

type Props = ReviewCommentBinding & {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly onSelect: (threadId: string) => void;
  readonly onTryAgain: () => void;
  readonly onStartOver: () => void;
  readonly hunk?: ReactNode;
};

const EMPTY_CANDIDATES: ReadonlyArray<ResolveCandidateWithItems> = [];
const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];
const DECIDED_NOTE_STATES = new Set(['accepted', 'replied', 'skipped', 'pushed', 'resolved']);

const POST_NOW_ACTION = 'reviewComment.postReplyNow';

const HINT_OPTIONAL: ReadonlySet<ReviewCompose['mode']> = new Set([
  'redraft',
  'fixAnyway',
  'rewrite',
]);

export const ReviewComment = ({
  sessionId,
  entry,
  entries,
  compose,
  isEditingReply,
  isModelOpen,
  isSubmitting,
  pendingActionId,
  error,
  onToggleModel,
  onRun,
  onComposeChange,
  onComposeSubmit,
  onComposeCancel,
  onEditReply,
  onReplyDone,
  onSelect,
  onTryAgain,
  onStartOver,
  hunk = null,
}: Props) => {
  const { row, state, word, threadId } = entry;
  const { answer: answered } = useThreadQuestion({
    sessionId,
    threadId,
    question: row.thread.question ?? null,
  });
  const provider = REVIEW_SOURCE_LABEL[row.thread.sourceKind ?? 'github'];
  const isNote = row.thread.originKind === 'diff_comment';
  const canResolve = REVIEW_SOURCE_CAPABILITIES[row.thread.sourceKind ?? 'github'].canResolve;
  const isPushFailed = entry.resolveWord === 'push_failed';
  const target = useMemo(
    () => ({ kind: 'reviewComment' as const, sessionId, threadId }),
    [sessionId, threadId],
  );
  const env = useActionEnv({ origin: 'button' });
  const { actions } = useObjectActions({ target, env });
  const candidates = useAppStore((s) => s.sessionResolveCandidates[sessionId] ?? EMPTY_CANDIDATES);
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const pickedModel = useAppStore((s) => s.resolveQueueView[sessionId]?.lastRouting?.model ?? null);
  const candidate = useMemo(
    () => selectResolveCandidate({ candidates, itemId: row.item.id }),
    [candidates, row.item.id],
  );
  const diff = useResolveCandidateDiff({ candidate });
  const members = useMemo(
    () =>
      sharedCandidateThreadIds({
        queueItemId: row.item.id,
        candidates,
        rows: entries.map((candidateEntry) => candidateEntry.row),
      }),
    [candidates, entries, row.item.id],
  );
  const { reply: draftReply, setReply } = useResolveItemDraft({
    sessionId,
    threadId,
    proposal: row.proposal,
  });
  const remote = entry.remote;
  const elsewhere = entry.facts?.elsewhere ?? null;
  const verdict = entry.facts?.verdict ?? null;
  const folded = entry.facts?.folded ?? null;
  const editedReply = useAppStore((s) => s.resolveItemDrafts[sessionId]?.[threadId]?.reply ?? null);
  const isPushedMissing = entry.facts?.missing?.wasPushed === true;
  const isVerdictReply =
    remote === 'missing' &&
    !isPushedMissing &&
    (verdict?.kind === 'fixed_elsewhere' || verdict?.kind === 'obsolete');
  const remoteReply = (): string => {
    if (folded !== null) {
      return foldedReply({ sha: folded.sha, landedAs: folded.landedAs });
    }
    if (editedReply !== null && editedReply.trim() !== '') {
      return editedReply;
    }
    return verdict === null ? '' : verdictReply({ verdict });
  };
  const reply =
    remote === 'looks_fixed' && elsewhere !== null
      ? handledByLine({ fix: elsewhere })
      : remote === 'folded' || remote === 'missing'
        ? remoteReply()
        : draftReply;
  const [replyText, setReplyText] = useState(reply);
  const replyLanding = useFreshLanding({
    liveKey: landingLiveKey({ scope: 'resolve-thread', id: threadId }),
    text: reply,
  });
  const note = row.reviewerNote;
  const author = note?.author ?? null;
  const canEditReply = actions.some((action) => action.id === 'reviewComment.editReply');
  const isOwnFixGone = remote === 'looks_fixed' || remote === 'missing' || remote === 'folded';
  const hasChange = candidate !== null && !isOwnFixGone;
  const blocker = sharedCandidateBlocker({ members });
  const previous = useMemo(
    () => previousAttemptsOf({ attempts, threadId, activeAttemptId: row.thread.activeAttemptId }),
    [attempts, row.thread.activeAttemptId, threadId],
  );
  const attemptNumber =
    row.attempt !== null && (state === 'failed' || previous.length > 0)
      ? attemptNumberOf({ attempts, threadId, attemptId: row.attempt.id })
      : null;
  const isFailed = state === 'failed';
  const composeCopy =
    compose !== null && isFailed && compose.mode === 'redraft'
      ? {
          label: FAILED_RUN_COPY.hintLabel,
          placeholder: 'Say what to change, in your own words',
          submit: tryAgainLabel({
            modelName: pickedModel === null ? null : modelLabel(pickedModel),
            hasHint: compose.text.trim() !== '',
          }),
        }
      : compose === null
        ? null
        : {
            ...COMPOSE_COPY[compose.mode],
            placeholder: composePlaceholder({ mode: compose.mode, provider }),
          };

  const isPostable = row.thread.originKind !== 'diff_comment' && row.thread.sourceKind !== 'local';
  const isPushWaiting = entries.some(
    (candidate) => candidate.state === 'accepted' && candidate.remote !== 'on_origin',
  );
  const replyNoteKind = replyNoteKindOf({
    state,
    remote,
    isPostable,
    isPublishing: row.thread.stage === 'publishing',
    isPushWaiting,
    isPosted: row.thread.disposition !== 'fix' && row.thread.replyPostedAt !== null,
  });
  const replyShown =
    !isNote &&
    replyNoteKind !== 'posted' &&
    remote !== 'you_replied' &&
    (remote === 'missing'
      ? isVerdictReply
      : reply.trim() !== '' ||
        (state !== 'new' && state !== 'drafting' && state !== 'needs' && state !== 'failed'));
  const replyUrl =
    row.commentThread?.replies.find((candidate) => candidate.id === row.thread.replyId)?.url ??
    row.commentThread?.head.url ??
    null;

  const startEdit = (): void => {
    setReplyText(reply);
    onEditReply();
  };
  const saveReply = (): void => {
    setReply(replyText);
    onReplyDone();
  };

  return (
    <article
      aria-label={REVIEW_FLOW_LABEL.comment}
      data-review-comment={threadId}
      className="flex min-w-0 flex-col gap-4"
    >
      {hunk}

      <div className="min-w-0 rounded-lg bg-subtle px-4 py-3">
        <ReviewerCommentBlock commentThread={row.commentThread} />
      </div>

      <PreviousAttempts attempts={previous} />

      {remote !== null && <ThreadGitEvidence sessionId={sessionId} entry={entry} />}

      {entry.newReplies.length > 0 && <NewReplyNote replies={entry.newReplies} />}

      {state === 'outdated' && remote === null && entry.change !== null && (
        <SourceChangeCard change={entry.change} />
      )}

      {remote === 'missing' && entry.isChecking && (
        <ThreadRecheckLine sessionId={sessionId} agentId={entry.checkAgentId} />
      )}

      {remote === 'missing' && !entry.isChecking && verdict !== null && (
        <ThreadVerdictCard sessionId={sessionId} verdict={verdict} isPushed={isPushedMissing} />
      )}

      {remote === 'missing' && !entry.isChecking && entry.checkError !== null && (
        <p role="status" className="text-meta text-warning">
          {entry.checkError}
        </p>
      )}

      {row.attempt !== null && !isOwnFixGone && isFailed && (
        <AgentLine
          attempt={row.attempt}
          toneKey={entry.toneKey}
          word={word}
          attemptNumber={attemptNumber}
        />
      )}

      {answered !== null && state !== 'needs' && (
        <p
          data-testid="resolver-answered"
          className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-muted-foreground"
        >
          <CircleCheck size={ICON_SIZE.control} aria-hidden className="shrink-0 text-success" />
          <span className="min-w-0">
            {FIX_RUN_QUESTION_COPY.answered} <span className="text-foreground">{answered}</span>
          </span>
        </p>
      )}

      {state === 'drafting' && row.attempt !== null && !isOwnFixGone && (
        <WorkingRun attempt={row.attempt} />
      )}

      {state === 'needs' && <ResolverQuestionCard sessionId={sessionId} row={row} />}

      {hasChange && state !== 'drafting' && (
        <ProposedChange files={diff.files} isLoading={diff.isLoading} error={diff.error} />
      )}

      {members.length > 0 && remote === null && (state === 'ready' || state === 'edited') && (
        <div className="flex min-w-0 flex-col gap-1 text-meta text-muted-foreground">
          <p>{sharedFixLine({ count: members.length })}</p>
          <ul className="flex min-w-0 flex-col">
            {members.map((member) => (
              <li key={member.threadId} className="min-w-0 list-none">
                <button
                  type="button"
                  onClick={() => onSelect(member.threadId)}
                  className={cn(
                    'block max-w-full truncate rounded-sm text-left text-foreground underline-offset-2 hover:underline',
                    FOCUS_RING,
                  )}
                >
                  {member.title ?? RESOLVE_COMMENT_UNAVAILABLE}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {blocker !== null && (
        <p className="text-meta text-warning">
          {blocker === 'deferred' ? PARTIAL_ACCEPTANCE : PARTIAL_REFUSAL}
        </p>
      )}

      {replyShown && (
        <div
          key={replyLanding.fadeKey}
          {...replyLanding.fade}
          className="group/reply flex min-w-0 flex-col gap-2"
        >
          <SectionHeader
            label={replyHeading({ author })}
            headingLevel={2}
            meta={
              state === 'edited' ? (
                <Chip kind="state" tone="neutral" label={REVIEW_FLOW_LABEL.edited} />
              ) : state === 'replied' && canResolve && isResolveOnly({ row }) ? (
                <Chip kind="state" tone="neutral" label={REVIEW_FLOW_LABEL.resolveOnly} />
              ) : undefined
            }
          />
          {isEditingReply ? (
            <CommentComposer
              label={REVIEW_FLOW_LABEL.editReply}
              submitLabel={REVIEW_FLOW_LABEL.saveReply}
              cancelLabel={REVIEW_FLOW_LABEL.cancel}
              value={replyText}
              onChange={setReplyText}
              onSubmit={saveReply}
              onCancel={onReplyDone}
              isEmptyAllowed
              error={error}
            />
          ) : canEditReply ? (
            <Tooltip content={REVIEW_FLOW_LABEL.editReply} anchorClassName="block min-w-0">
              <button
                type="button"
                onClick={startEdit}
                aria-label={REVIEW_FLOW_LABEL.editReply}
                className={cn(
                  '-mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-1 text-left hover:bg-hover',
                  FOCUS_RING,
                  'motion-safe:transition-colors',
                )}
              >
                <Markdown text={reply} variant="preview" className="text-body text-foreground" />
              </button>
            </Tooltip>
          ) : reply.trim() === '' ? null : (
            <Markdown
              text={row.delivery?.replyBody ?? reply}
              variant="preview"
              className="text-body text-foreground"
            />
          )}
        </div>
      )}

      {replyNoteKind !== null && (
        <ReplyNote
          kind={replyNoteKind}
          provider={provider}
          reply={reply}
          url={replyUrl}
          isRetry={error !== null}
          isBusy={pendingActionId === POST_NOW_ACTION}
          onPostNow={() => onRun(POST_NOW_ACTION)}
        />
      )}

      {replyNoteKind === null && DECIDED_NOTE_STATES.has(state) && remote === null && (
        <p className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-muted-foreground">
          <Check size={ICON_SIZE.control} aria-hidden className="shrink-0 text-success" />
          {decidedNote({
            state: state as 'accepted' | 'replied' | 'skipped' | 'pushed' | 'resolved',
            sha: conversationSha({ row }),
            provider,
            canResolve,
          })}
        </p>
      )}

      {isPushFailed && <PushFailedNote rowState={row.rowState} />}

      {isFailed && !isPushFailed && (
        <FailedRun
          sessionId={sessionId}
          target={target}
          attempt={row.attempt}
          rowState={row.rowState}
          actions={actions}
          isHintOpen={compose !== null && compose.mode === 'redraft'}
          isModelOpen={isModelOpen}
          onToggleModel={onToggleModel}
          isBusy={isSubmitting || pendingActionId !== null}
          onTryAgain={onTryAgain}
          onStartOver={onStartOver}
          onRun={onRun}
        />
      )}

      {compose !== null && composeCopy !== null ? (
        <div className="flex min-w-0 flex-col gap-2">
          <SectionHeader label={composeCopy.label} headingLevel={2} />
          <CommentComposer
            label={composeCopy.label}
            placeholder={composeCopy.placeholder}
            submitLabel={composeCopy.submit}
            cancelLabel={REVIEW_FLOW_LABEL.cancel}
            value={compose.text}
            onChange={onComposeChange}
            onSubmit={onComposeSubmit}
            onCancel={onComposeCancel}
            isEmptyAllowed={HINT_OPTIONAL.has(compose.mode)}
            isBusy={isSubmitting}
            error={error}
          />
        </div>
      ) : null}
    </article>
  );
};
