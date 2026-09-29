import { useMemo, useState, type KeyboardEvent } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { Button, Chip, KbdPill, Markdown, SectionHeader, Textarea, Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import {
  PARTIAL_ACCEPTANCE,
  PARTIAL_REFUSAL,
} from '../../../../store/slices/resolve/acceptResolveQueueItem';
import type { ResolveCandidateWithItems } from '../../../../store/slices/resolve/state';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import type { ResolvedAction } from '../../../actions/types';
import { OUTDATED_REASON } from '../../../actions/kinds/reviewComment';
import type { ReviewComposeMode } from '../../../review/reviewRequest';
import { conversationSha } from '../../conversationAgentResult';
import { useResolveCandidateDiff } from '../../hooks/useResolveCandidateDiff';
import { useResolveItemDraft } from '../../hooks/useResolveItemDraft';
import { isResolveOnly } from '../../reviewCommentState';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import {
  COMPOSE_COPY,
  REVIEW_FLOW_LABEL,
  decidedNote,
  replyHeading,
  sharedFixLine,
} from '../../reviewFlowCopy';
import { REMOTE_LABEL } from '../../reviewRemote';
import { selectResolveCandidate } from '../../selectResolveCandidate';
import { handledByLine } from '../../../../store/slices/resolve/threadGitState';
import { foldedReply, verdictReply } from '../../commentVerdict';
import { sharedCandidateBlocker, sharedCandidateThreadIds } from '../../sharedCandidateThreadIds';
import { ReviewerCommentBlock } from './ReviewerCommentBlock';
import { AgentLine } from './AgentLine';
import { ProposedChange } from './ProposedChange';
import { ThreadGitEvidence } from './ThreadGitEvidence';
import { ThreadRecheckLine } from './ThreadRecheckLine';
import { ThreadVerdictCard } from './ThreadVerdictCard';
import type { ReviewEntry } from './useReviewEntries';

export type ReviewCompose = {
  readonly threadId: string;
  readonly mode: ReviewComposeMode;
  readonly text: string;
};

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly compose: ReviewCompose | null;
  readonly isEditingReply: boolean;
  readonly isSubmitting: boolean;
  readonly pendingActionId: string | null;
  readonly error: string | null;
  readonly onRun: (actionId: string) => void;
  readonly onComposeChange: (text: string) => void;
  readonly onComposeSubmit: () => void;
  readonly onComposeCancel: () => void;
  readonly onEditReply: () => void;
  readonly onReplyDone: () => void;
  readonly onSelect: (threadId: string) => void;
};

const EMPTY_CANDIDATES: ReadonlyArray<ResolveCandidateWithItems> = [];
const DECIDED_NOTE_STATES = new Set(['accepted', 'replied', 'skipped', 'pushed', 'resolved']);

const verbsOf = (actions: ReadonlyArray<ResolvedAction>): ReadonlyArray<ResolvedAction> => [
  ...actions.filter((action) => action.slot === 'primary'),
  ...actions.filter((action) => action.slot === 'secondary'),
];

const isComposeBlocked = ({ compose }: { readonly compose: ReviewCompose }): boolean =>
  compose.mode !== 'redraft' && compose.text.trim() === '';

const onSubmitKeys =
  ({ onSubmit, onCancel }: { readonly onSubmit: () => void; readonly onCancel: () => void }) =>
  (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  };

export const ReviewComment = ({
  sessionId,
  entry,
  entries,
  compose,
  isEditingReply,
  isSubmitting,
  pendingActionId,
  error,
  onRun,
  onComposeChange,
  onComposeSubmit,
  onComposeCancel,
  onEditReply,
  onReplyDone,
  onSelect,
}: Props) => {
  const { row, state, word, threadId } = entry;
  const target = useMemo(
    () => ({ kind: 'reviewComment' as const, sessionId, threadId }),
    [sessionId, threadId],
  );
  const env = useActionEnv({ origin: 'button' });
  const { actions } = useObjectActions({ target, env });
  const candidates = useAppStore((s) => s.sessionResolveCandidates[sessionId] ?? EMPTY_CANDIDATES);
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
    if (editedReply !== null && editedReply.trim() !== '') {
      return editedReply;
    }
    if (folded !== null) {
      return foldedReply({ landedAs: folded.landedAs });
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
  const note = row.reviewerNote;
  const author = note?.author ?? null;
  const verbs = verbsOf(actions);
  const canEditReply = actions.some((action) => action.id === 'reviewComment.editReply');
  const isOwnFixGone = remote === 'looks_fixed' || remote === 'missing' || remote === 'folded';
  const hasChange = candidate !== null && !isOwnFixGone;
  const replyShown =
    remote !== 'you_replied' &&
    (remote === 'missing'
      ? isVerdictReply
      : reply.trim() !== '' || (state !== 'new' && state !== 'drafting' && state !== 'needs'));
  const blocker = sharedCandidateBlocker({ members });

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
      className="flex min-w-0 max-w-[76ch] flex-col gap-5"
    >
      <header className="flex min-w-0 items-center gap-2 text-secondary">
        {author !== null && (
          <span
            aria-hidden
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-subtle text-meta uppercase text-muted-foreground"
          >
            {author.charAt(0)}
          </span>
        )}
        {author !== null && <span className="shrink-0 text-label text-foreground">{author}</span>}
        {note !== null && (
          <span className="shrink-0 text-muted-foreground">
            {formatRelativeAge({ fromIso: new Date(note.createdAtMs).toISOString() })}
          </span>
        )}
        {note?.location != null && (
          <span className="min-w-0 truncate font-mono text-faint-foreground">{note.location}</span>
        )}
        <span className="ml-auto flex shrink-0 items-center">
          <ObjectOverflowMenu target={target} label={REVIEW_FLOW_LABEL.commentActions} />
        </span>
      </header>

      <div className="min-w-0 rounded-lg bg-subtle px-4 py-3">
        <ReviewerCommentBlock commentThread={row.commentThread} />
      </div>

      {remote !== null && <ThreadGitEvidence sessionId={sessionId} entry={entry} />}

      {remote === 'missing' && entry.isChecking && (
        <ThreadRecheckLine sessionId={sessionId} agentId={entry.checkAgentId} />
      )}

      {remote === 'missing' && !entry.isChecking && verdict !== null && (
        <ThreadVerdictCard sessionId={sessionId} verdict={verdict} isPushed={isPushedMissing} />
      )}

      {remote === 'missing' && !entry.isChecking && entry.checkError !== null && (
        <p role="status" className="text-secondary text-warning">
          {entry.checkError}
        </p>
      )}

      {row.attempt !== null && !isOwnFixGone && (
        <AgentLine attempt={row.attempt} state={state} word={word} />
      )}

      {state === 'needs' && row.thread.question != null && row.thread.question !== '' && (
        <div className="flex min-w-0 flex-col gap-2">
          <SectionHeader label={REVIEW_FLOW_LABEL.agentAsks} headingLevel={2} />
          <Markdown
            text={row.thread.question}
            variant="preview"
            className="text-body text-foreground"
          />
        </div>
      )}

      {hasChange && state !== 'drafting' && (
        <ProposedChange files={diff.files} isLoading={diff.isLoading} error={diff.error} />
      )}

      {members.length > 0 && remote === null && (state === 'ready' || state === 'edited') && (
        <div className="flex min-w-0 flex-col gap-1 text-secondary text-muted-foreground">
          <p>{sharedFixLine({ count: members.length })}</p>
          <ul className="flex min-w-0 flex-col">
            {members.map((member) => (
              <li key={member.threadId} className="min-w-0 list-none">
                <button
                  type="button"
                  onClick={() => onSelect(member.threadId)}
                  className="block max-w-full truncate rounded-sm text-left text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {member.title ?? RESOLVE_COMMENT_UNAVAILABLE}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {blocker !== null && (
        <p className="text-secondary text-warning">
          {blocker === 'deferred' ? PARTIAL_ACCEPTANCE : PARTIAL_REFUSAL}
        </p>
      )}

      {replyShown && (
        <div className="group/reply flex min-w-0 flex-col gap-2">
          <SectionHeader
            label={replyHeading({ author })}
            headingLevel={2}
            meta={
              state === 'edited' ? (
                <Chip tone="neutral" size="3xs" label={REVIEW_FLOW_LABEL.edited} />
              ) : state === 'replied' && isResolveOnly({ row }) ? (
                <Chip tone="neutral" size="3xs" label={REVIEW_FLOW_LABEL.resolveOnly} />
              ) : undefined
            }
          />
          {isEditingReply ? (
            <div className="flex min-w-0 flex-col gap-2">
              <Textarea
                aria-label={REVIEW_FLOW_LABEL.editReply}
                value={replyText}
                autoFocus
                autoGrow
                minRows={3}
                maxRows={12}
                className="text-body"
                onChange={(event) => setReplyText(event.target.value)}
                onKeyDown={onSubmitKeys({ onSubmit: saveReply, onCancel: onReplyDone })}
              />
              <div className="flex items-center justify-end gap-2">
                <span className="mr-auto text-secondary text-faint-foreground">
                  {REVIEW_FLOW_LABEL.keysHint}
                </span>
                <Button size="sm" variant="ghost" onClick={onReplyDone}>
                  {REVIEW_FLOW_LABEL.cancel}
                </Button>
                <Button size="sm" variant="primary" onClick={saveReply}>
                  {REVIEW_FLOW_LABEL.saveReply}
                </Button>
              </div>
            </div>
          ) : canEditReply ? (
            <Tooltip content={REVIEW_FLOW_LABEL.editReply} anchorClassName="block min-w-0">
              <button
                type="button"
                onClick={startEdit}
                aria-label={REVIEW_FLOW_LABEL.editReply}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-1 text-left hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors"
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

      {DECIDED_NOTE_STATES.has(state) && remote === null && (
        <p className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-4 py-2.5 text-secondary text-muted-foreground">
          <Check size={ICON_SIZE.control} aria-hidden className="shrink-0 text-success" />
          {decidedNote({
            state: state as 'accepted' | 'replied' | 'skipped' | 'pushed' | 'resolved',
            sha: conversationSha({ row }),
          })}
        </p>
      )}

      {state === 'outdated' && (
        <p className="flex min-w-0 items-start gap-2 rounded-lg bg-subtle px-4 py-2.5 text-secondary text-foreground">
          <AlertCircle
            size={ICON_SIZE.control}
            aria-hidden
            className="mt-0.5 shrink-0 text-warning"
          />
          {OUTDATED_REASON}
        </p>
      )}

      {state === 'failed' && row.rowState.sentence !== null && (
        <p className="flex min-w-0 items-start gap-2 rounded-lg bg-subtle px-4 py-2.5 text-secondary text-foreground">
          <AlertCircle
            size={ICON_SIZE.control}
            aria-hidden
            className="mt-0.5 shrink-0 text-danger"
          />
          {row.rowState.sentence}
        </p>
      )}

      {compose !== null ? (
        <div className="flex min-w-0 flex-col gap-2">
          <SectionHeader label={COMPOSE_COPY[compose.mode].label} headingLevel={2} />
          <Textarea
            aria-label={COMPOSE_COPY[compose.mode].label}
            placeholder={COMPOSE_COPY[compose.mode].placeholder}
            value={compose.text}
            autoFocus
            autoGrow
            minRows={3}
            maxRows={12}
            disabled={isSubmitting}
            className="text-body"
            onChange={(event) => onComposeChange(event.target.value)}
            onKeyDown={onSubmitKeys({
              onSubmit: () => {
                if (!isComposeBlocked({ compose })) {
                  onComposeSubmit();
                }
              },
              onCancel: onComposeCancel,
            })}
          />
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-secondary text-faint-foreground">
              {REVIEW_FLOW_LABEL.keysHint}
            </span>
            <Button size="sm" variant="ghost" disabled={isSubmitting} onClick={onComposeCancel}>
              {REVIEW_FLOW_LABEL.cancel}
            </Button>
            <Button
              size="sm"
              variant="primary"
              isBusy={isSubmitting}
              disabled={isComposeBlocked({ compose })}
              onClick={onComposeSubmit}
            >
              {COMPOSE_COPY[compose.mode].submit}
            </Button>
          </div>
        </div>
      ) : (
        !isEditingReply &&
        verbs.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {verbs.map((action) => {
              const button = (
                <Button
                  key={action.id}
                  size="sm"
                  variant={action.slot === 'primary' ? 'primary' : 'ghost'}
                  data-review-verb={action.id}
                  disabled={
                    action.blockedReason !== null ||
                    (pendingActionId !== null && pendingActionId !== action.id)
                  }
                  isBusy={pendingActionId === action.id}
                  onClick={() => onRun(action.id)}
                >
                  {action.label}
                  {action.shortcut !== null && (
                    <KbdPill
                      aria-hidden
                      className={cn(
                        'ml-1 h-4 min-w-4 text-meta',
                        action.slot === 'primary' && 'border-on-tone/30 bg-on-tone/15 text-on-tone',
                      )}
                    >
                      {shortcutGlyphs(action.shortcut)}
                    </KbdPill>
                  )}
                </Button>
              );
              return action.blockedReason === null ? (
                button
              ) : (
                <Tooltip
                  key={action.id}
                  content={action.blockedReason}
                  anchorClassName="inline-flex"
                >
                  {button}
                </Tooltip>
              );
            })}
            {remote === 'on_origin' && (
              <span className="text-secondary text-faint-foreground">
                {REMOTE_LABEL.nothingToPush}
              </span>
            )}
          </div>
        )
      )}
      {error !== null && (
        <p role="alert" className="text-secondary text-danger">
          {error}
        </p>
      )}
    </article>
  );
};
