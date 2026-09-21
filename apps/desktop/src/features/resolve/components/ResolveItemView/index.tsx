import { Button, Divider, Markdown, PANE_RHYTHM, ScrollFade, SectionHeader, cn } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import type { ResolveChecksSummary } from '../../checkReceipts';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import type { ResolveProposalKind } from '../../../../store/slices/resolve/resolveProposalKind';
import { EMPTY_REFUSAL_REPLY } from '../../../../store/slices/resolve/refuseResolveQueueItem';
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
import { RunCard } from './RunCard';

type Props = {
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
  readonly onCancelRevise: () => void;
  readonly onCancelRefuse: () => void;
  readonly onRefuse: () => void;
  readonly onSendToAgent: () => void;
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

export const ResolveItemView = ({
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
  onCancelRevise,
  onCancelRefuse,
  onRefuse,
  onSendToAgent,
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

  return (
    <div
      data-testid={fieldId}
      className="flex h-full min-h-0 min-w-0 flex-col bg-elevated text-foreground"
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
      <ScrollFade className="min-h-0 flex-1" viewportClassName="p-3" fadeFrom="elevated">
        <div className={cn(PANE_RHYTHM.stack, 'min-w-0')}>
          <ReviewerCommentBlock commentThread={row.commentThread} onOpenUrl={onOpenUrl} />
          {question != null && question !== '' && (
            <div className="flex min-w-0 flex-col gap-2">
              <SectionHeader label={RESOLVE_ITEM_LABEL.agentQuestion} headingLevel={3} />
              <Markdown
                text={question}
                variant="preview"
                className="max-w-[65ch] text-sm text-foreground"
              />
            </div>
          )}
          {!isDelivered && mode === 'read' && !isAnswering && (
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
          {note !== null && <p className="text-2xs text-warning">{note}</p>}
          {error !== null && <p className="text-2xs text-danger">{error}</p>}
          {(canRunCheck || checks.receipts.length > 0) && (
            <ChecksBlock
              checks={checks}
              canRunCheck={canRunCheck}
              isRunning={isCheckRunning}
              note={checksNote}
              onRunCheck={onRunCheck}
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
          {coveredRows.length > 0 && (
            <div className="flex min-w-0 flex-col gap-2">
              <SectionHeader
                label={RESOLVE_ITEM_LABEL.relatedComments}
                headingLevel={3}
                hint={sharedRunHeading({ count: coveredRows.length + 1 })}
              />
              <ul className="flex min-w-0 flex-col gap-2">
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
          {row.attempt !== null && (
            <RunCard
              attempt={row.attempt}
              costUsd={costUsd}
              isViewActionShown={
                actions.primary?.id !== 'view_agent' && actions.secondary?.id !== 'view_agent'
              }
              onStop={onStopRun}
              onViewWork={onViewWork}
            />
          )}
        </div>
      </ScrollFade>
      {mode === 'refuse' && (
        <>
          <Divider />
          <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
            <p className="min-w-0 text-2xs text-warning">
              {isReplyBlank ? EMPTY_REFUSAL_REPLY : ''}
            </p>
            <div className="flex items-center gap-3">
              <Button size="sm" variant="ghost" disabled={isBusy} onClick={onCancelRefuse}>
                {RESOLVE_QUEUE_ACTION_LABEL.cancel}
              </Button>
              <Button
                size="sm"
                variant="primary"
                data-resolve-primary
                disabled={isBusy || isReplyBlank}
                onClick={onRefuse}
              >
                Save refusal
              </Button>
            </div>
          </div>
        </>
      )}
      {(mode === 'revise' ||
        mode === 'answer' ||
        mode === 'start' ||
        mode === 'retry' ||
        mode === 'restart') && (
        <>
          <Divider />
          <div className="flex shrink-0 items-center justify-end gap-2 px-3 py-2">
            <Button size="sm" variant="ghost" disabled={isBusy} onClick={onCancelRevise}>
              {RESOLVE_QUEUE_ACTION_LABEL.cancel}
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-resolve-primary
              disabled={
                isBusy || ((mode === 'revise' || mode === 'answer') && instruction.trim() === '')
              }
              onClick={onSendToAgent}
            >
              {mode === 'answer'
                ? 'Start next attempt'
                : mode === 'revise'
                  ? 'Send revision'
                  : 'Start agent'}
            </Button>
          </div>
        </>
      )}
      {mode === 'edit_reply' && (
        <>
          <Divider />
          <div className="flex shrink-0 items-center justify-end gap-2 px-3 py-2">
            <Button size="sm" variant="ghost" disabled={isBusy} onClick={onCancelRefuse}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-resolve-primary
              disabled={isBusy || isReplyBlank}
              onClick={() => onAction('approve')}
            >
              {proposalKind === 'fix' ? (actions.primary?.label ?? 'Approve fix') : 'Approve reply'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
