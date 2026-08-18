import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PrComment } from '@goodboy/types';
import { GhostActionButton } from '@goodboy/ui';
import type { ResolverActionKind } from '../../../resolverActions';
import type { ResolverRunningThreadAction } from '../../../hooks/useResolverActions';
import type { ResolverThreadSettlement } from '../../../resolverThreadSettlements';
import { resolverThreadBrief } from '../../../resolverThreadBrief';
import { resolverThreadDecisions } from '../../../resolverThreadDecisions';
import { resolverReplySummary } from '../../../resolverReplySummary';
import { prCommentLocation } from '../../../pr-comment-location';
import { ResolverThreadCardHeader } from './ResolverThreadCardHeader';
import { ResolverThreadComment } from './ResolverThreadComment';
import { ResolverThreadDecisions } from './ResolverThreadDecisions';
import { ResolverThreadLead } from './ResolverThreadLead';
import { ResolverThreadReply } from './ResolverThreadReply';

type Props = {
  readonly settlement: ResolverThreadSettlement;
  readonly comment: PrComment | null;
  readonly position: number;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
  readonly canAct: boolean;
  readonly actLockReason: string | null;
  readonly runningThreadAction: ResolverRunningThreadAction | null;
  readonly onRun: (params: {
    readonly threadId: string;
    readonly kind: ResolverActionKind;
    readonly text: string;
    readonly notes: string;
  }) => Promise<void>;
  readonly onReplyChange: (params: { readonly threadId: string; readonly reply: string }) => void;
  readonly onOpenThread: ((threadId: string) => void) | null;
};

const PLACEHOLDER: Record<ResolverThreadSettlement['kind'], string> = {
  resolved: 'Reply posted with the commit link',
  wontfix: 'Why this thread can be closed without a change',
  analyzed: 'What to reply on this thread',
  open: 'Nothing recorded yet, write the reply to post',
};

export const ResolverThreadCard = ({
  settlement,
  comment,
  position,
  prNumber,
  isBusy,
  canAct,
  actLockReason,
  runningThreadAction,
  onRun,
  onReplyChange,
  onOpenThread,
}: Props) => {
  const initial = settlement.reason ?? settlement.reply ?? '';
  const [edited, setEdited] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCommentShown, setIsCommentShown] = useState(false);
  const text = edited ?? initial;
  const runningKind =
    runningThreadAction?.threadId === settlement.threadId ? runningThreadAction.kind : null;
  const isEditable = canAct && !settlement.isClosed;
  const isCollapsible = settlement.isClosed;
  const isOpen = !isCollapsible || isExpanded;
  const plan = resolverThreadDecisions({ settlement, prNumber, isBusy, actLockReason });
  const brief = resolverThreadBrief({
    settlement,
    commentBody: comment?.body ?? null,
    prNumber,
    isBusy,
  });
  const draftedReply =
    settlement.reply !== null && settlement.reply !== initial ? settlement.reply : null;
  const summary = resolverReplySummary({ text: initial !== '' ? initial : (comment?.body ?? '') });

  return (
    <li
      className="flex min-w-0 flex-col gap-3 rounded-lg bg-muted/20 p-4"
      data-testid="resolver-thread-card"
    >
      <ResolverThreadCardHeader
        settlement={settlement}
        position={position}
        summary={isCollapsible && !isExpanded ? summary : null}
        isCollapsible={isCollapsible}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((current) => !current)}
        onOpenThread={onOpenThread === null ? null : () => onOpenThread(settlement.threadId)}
      />
      {isOpen && <ResolverThreadLead brief={brief} />}
      {isOpen && comment !== null && (
        <div className="flex flex-col gap-2">
          <div className="flex">
            <GhostActionButton
              icon={isCommentShown ? ChevronDown : ChevronRight}
              label={isCommentShown ? 'Hide the comment' : 'Read the comment'}
              onClick={() => setIsCommentShown((current) => !current)}
            />
          </div>
          {isCommentShown && (
            <ResolverThreadComment
              author={comment.author}
              location={prCommentLocation({ comment })}
              body={comment.body}
            />
          )}
        </div>
      )}
      {isOpen && draftedReply !== null && (
        <ResolverThreadReply
          label="Reply"
          value={draftedReply}
          placeholder={PLACEHOLDER[settlement.kind]}
          ariaLabel={`Drafted reply for thread ${position}`}
          isEditable={false}
          onChange={() => undefined}
          onCommit={() => undefined}
        />
      )}
      {isOpen && (isEditable || text !== '') && (
        <ResolverThreadReply
          label={settlement.kind === 'wontfix' ? 'Closing reason' : 'Reply'}
          value={text}
          placeholder={PLACEHOLDER[settlement.kind]}
          ariaLabel={`Reply for thread ${position}`}
          isEditable={isEditable}
          onChange={setEdited}
          onCommit={() => onReplyChange({ threadId: settlement.threadId, reply: text })}
        />
      )}
      {isOpen && !settlement.isClosed && (
        <ResolverThreadDecisions
          plan={plan}
          ariaScope={`thread ${position}`}
          isReplyEmpty={text.trim() === ''}
          runningKind={runningKind}
          isFrozen={runningThreadAction !== null}
          onRun={({ kind, notes }) => onRun({ threadId: settlement.threadId, kind, text, notes })}
        />
      )}
    </li>
  );
};
