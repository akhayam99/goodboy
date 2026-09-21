import { Button, Divider, Markdown, PANE_RHYTHM, ScrollFade, SectionHeader, cn } from '@goodboy/ui';
import type { FileDiff, SessionId } from '@goodboy/types';
import type { ResolveChecksSummary } from '../../checkReceipts';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import type { ResolveProposalKind } from '../../../../store/slices/resolve/resolveProposalKind';
import { EMPTY_REFUSAL_REPLY } from '../../../../store/slices/resolve/refuseResolveQueueItem';
import { EMPTY_DISCUSSION_REPLY } from '../../../../store/slices/resolve/discussResolveThread';
import { RESOLVE_ITEM_LABEL, runNote } from '../../resolveItemCopy';
import {
  RESOLVE_COMMENT_UNAVAILABLE,
  RESOLVE_QUEUE_ACTION_LABEL,
  RESOLVE_QUEUE_NEXT_STEP,
  sharedRunHeading,
} from '../../resolveQueueCopy';
import { deliverySupportLine } from '../../resolveDeliverySupport';
import { ResolveItemHeader } from '../ResolveItemHeader';
import type { ResolveItemActionId, ResolveItemActionSet } from '../../resolveItemActions';
import { ChangeBlock } from './ChangeBlock';
import { ChecksBlock } from './ChecksBlock';
import type { ResolveDecisionMode } from '../../resolveItemDraft';
import { DecisionBlock } from './DecisionBlock';
import { SharedCandidateNote } from './SharedCandidateNote';
import type { SharedCandidateMember } from '../../sharedCandidateThreadIds';
import { ResolveCommitIdentity } from './ResolveCommitIdentity';
import { ReviewerCommentBlock } from './ReviewerCommentBlock';
import { ResolveAgentActivity } from '../ResolveAgentActivity';

type Props = {
  readonly sessionId: SessionId;
  readonly row: ResolveQueueRow;
  readonly prNumber: number;
  readonly coveredRows: ReadonlyArray<ResolveQueueRow>;
  readonly files: ReadonlyArray<FileDiff>;
  readonly isDiffLoading: boolean;
  readonly diffError: string | null;
  readonly checks: ResolveChecksSummary;
  readonly costUsd: number | null;
  readonly candidateSha: string | null;
  readonly reply: string;
  readonly instruction: string;
  readonly mode: ResolveDecisionMode;
  readonly proposalKind: ResolveProposalKind;
  readonly isBusy: boolean;
  readonly sharedMembers: ReadonlyArray<SharedCandidateMember>;
  readonly canRunCheck: boolean;
  readonly isCheckRunning: boolean;
  readonly checksNote: string | null;
  readonly error: string | null;
  readonly actions: ResolveItemActionSet;
  readonly onChangeReply: (value: string) => void;
  readonly onChangeInstruction: (value: string) => void;
  readonly onEditReply: () => void;
  readonly onAction: (id: ResolveItemActionId) => void;
  readonly onCancelEditing: () => void;
  readonly onCommitEditing: () => void;
  readonly onBack: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly onOpenInDiff: () => void;
  readonly onOpenCommit: (params: { readonly sha: string }) => void;
  readonly onRunCheck: () => void;
  readonly onStopRun: () => void;
  readonly onViewWork: () => void;
  readonly onSelectRelated: (threadId: string) => void;
  readonly onOpenUrl: (url: string) => void;
};

type FooterParams = {
  readonly mode: ResolveDecisionMode;
  readonly isAnswering: boolean;
  readonly isReplyBlank: boolean;
};

const FOOTER_NOTE = ({ mode, isAnswering, isReplyBlank }: FooterParams): string => {
  if (isReplyBlank && mode === 'close') {
    return EMPTY_REFUSAL_REPLY;
  }
  if (isReplyBlank && mode === 'discuss') {
    return EMPTY_DISCUSSION_REPLY;
  }
  if (mode === 'resolve') {
    return RESOLVE_ITEM_LABEL.resolveNote;
  }
  if (mode === 'discuss') {
    return RESOLVE_ITEM_LABEL.discussionNote;
  }
  if (mode === 'close') {
    return RESOLVE_ITEM_LABEL.closeNote;
  }
  if (mode === 'fix') {
    return isAnswering ? RESOLVE_ITEM_LABEL.answerNote : RESOLVE_ITEM_LABEL.fixNote;
  }
  return '';
};

const COMMIT_LABEL = ({ mode, isAnswering }: Omit<FooterParams, 'isReplyBlank'>): string => {
  if (mode === 'discuss') {
    return RESOLVE_ITEM_LABEL.sendReply;
  }
  if (mode === 'close') {
    return RESOLVE_ITEM_LABEL.closeComment;
  }
  if (mode === 'fix') {
    return isAnswering ? RESOLVE_ITEM_LABEL.startNextAttempt : RESOLVE_ITEM_LABEL.sendToAgent;
  }
  return RESOLVE_ITEM_LABEL.saveReply;
};

export const ResolveItemView = ({
  sessionId,
  row,
  prNumber,
  coveredRows,
  files,
  isDiffLoading,
  diffError,
  checks,
  costUsd,
  candidateSha,
  reply,
  instruction,
  mode,
  proposalKind,
  isBusy,
  sharedMembers,
  canRunCheck,
  isCheckRunning,
  checksNote,
  error,
  actions,
  onChangeReply,
  onChangeInstruction,
  onEditReply,
  onAction,
  onCancelEditing,
  onCommitEditing,
  onBack,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  onOpenInDiff,
  onOpenCommit,
  onRunCheck,
  onStopRun,
  onViewWork,
  onSelectRelated,
  onOpenUrl,
}: Props) => {
  const note = runNote({ stateReason: row.thread.stateReason });
  const isDelivered = row.status === 'pushed' || row.status === 'wont_fix_sent';
  const isReplyBlank = reply.trim() === '';
  const question = row.thread.question;
  const isAnswering = row.status === 'agent_asked';
  const fieldId = `resolve-item-${row.thread.threadId}`;
  const nextStep = RESOLVE_QUEUE_NEXT_STEP[row.status];
  const isEditing = mode !== 'read';
  const footerNote = FOOTER_NOTE({ mode, isAnswering, isReplyBlank });
  const commitLabel =
    mode === 'resolve'
      ? (actions.primary?.label ?? RESOLVE_ITEM_LABEL.resolve)
      : COMMIT_LABEL({ mode, isAnswering });
  const isCommitBlocked =
    (mode === 'fix' && isAnswering && instruction.trim() === '') ||
    ((mode === 'discuss' || mode === 'close') && isReplyBlank);

  return (
    <div
      data-testid={fieldId}
      className="flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground"
    >
      <ResolveItemHeader
        title={RESOLVE_ITEM_LABEL.comment}
        location={row.reviewerNote?.location ?? null}
        prNumber={prNumber}
        status={row.status}
        nextStep={nextStep}
        actions={actions}
        isEditing={isEditing}
        canPrevious={canPrevious}
        canNext={canNext}
        onBack={onBack}
        onPrevious={onPrevious}
        onNext={onNext}
        onAction={onAction}
      />
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-5 py-4" fadeFrom="background">
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex min-w-0 max-w-[68ch] flex-col gap-5">
            <ReviewerCommentBlock commentThread={row.commentThread} onOpenUrl={onOpenUrl} />
            {question != null && question !== '' && (
              <div className="flex min-w-0 flex-col gap-2">
                <SectionHeader label={RESOLVE_ITEM_LABEL.agentQuestion} headingLevel={3} />
                <Markdown text={question} variant="preview" className="text-sm text-foreground" />
              </div>
            )}
            {!isDelivered && (mode === 'read' || mode === 'resolve') && !isAnswering && (
              <SharedCandidateNote members={sharedMembers} onSelectMember={onSelectRelated} />
            )}
            <DecisionBlock
              fieldId={fieldId}
              reply={reply}
              instruction={instruction}
              mode={mode}
              proposalKind={proposalKind}
              isAnswering={isAnswering}
              isDelivered={isDelivered}
              deliveredReply={row.delivery?.replyBody ?? null}
              deliverySupport={deliverySupportLine({ row })}
              isBusy={isBusy}
              onChangeReply={onChangeReply}
              onChangeInstruction={onChangeInstruction}
              onEditReply={onEditReply}
            />
            {note !== null && <p className="text-2xs text-warning">{note}</p>}
            {error !== null && <p className="text-2xs text-danger">{error}</p>}
          </div>
          <aside
            aria-label={RESOLVE_ITEM_LABEL.aboutThisComment}
            className="flex min-w-0 max-w-[68ch] flex-col gap-5 xl:max-w-none xl:border-l xl:border-border-soft xl:pl-6"
          >
            {(row.item.integratedSha !== null ||
              candidateSha !== null ||
              (row.thread.commitShas?.length ?? 0) > 0) && (
              <ResolveCommitIdentity
                integratedSha={row.item.integratedSha}
                candidateSha={candidateSha}
                recordedShas={row.thread.commitShas ?? []}
                onOpenCommit={onOpenCommit}
              />
            )}
            {(candidateSha !== null || files.length > 0 || isDiffLoading || diffError !== null) && (
              <ChangeBlock
                files={files}
                isLoading={isDiffLoading}
                error={diffError}
                onOpenInDiff={onOpenInDiff}
              />
            )}
            {(canRunCheck || checks.receipts.length > 0) && (
              <ChecksBlock
                checks={checks}
                canRunCheck={canRunCheck}
                isRunning={isCheckRunning}
                note={checksNote}
                onRunCheck={onRunCheck}
              />
            )}
            {row.attempt !== null && (
              <ResolveAgentActivity
                sessionId={sessionId}
                attempt={row.attempt}
                costUsd={costUsd}
                runThreadCount={row.attempt.threadIds.length}
                isViewActionShown={
                  actions.primary?.id !== 'view_agent' && actions.secondary?.id !== 'view_agent'
                }
                onStop={onStopRun}
                onViewAgent={onViewWork}
              />
            )}
            {coveredRows.length > 0 && (
              <div className="flex min-w-0 flex-col gap-2">
                <SectionHeader
                  label={RESOLVE_ITEM_LABEL.relatedComments}
                  headingLevel={3}
                  hint={sharedRunHeading({ count: coveredRows.length + 1 })}
                />
                <ul className="flex min-w-0 flex-col gap-1.5">
                  {coveredRows.map((covered) => (
                    <li key={covered.thread.threadId} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectRelated(covered.thread.threadId)}
                        className="block w-full truncate rounded text-left text-xs leading-4 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                      >
                        {covered.reviewerNote?.body ?? RESOLVE_COMMENT_UNAVAILABLE}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </ScrollFade>
      {mode !== 'read' && (
        <>
          <Divider />
          <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
            <p
              className={cn(
                'min-w-0 text-2xs',
                isCommitBlocked ? 'text-warning' : 'text-muted-foreground',
              )}
            >
              {footerNote}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={isBusy} onClick={onCancelEditing}>
                {RESOLVE_QUEUE_ACTION_LABEL.cancel}
              </Button>
              <Button
                size="sm"
                variant="primary"
                data-resolve-primary
                disabled={isBusy || isCommitBlocked}
                onClick={onCommitEditing}
              >
                {commitLabel}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
