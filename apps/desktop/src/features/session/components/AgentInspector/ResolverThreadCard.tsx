import { useState } from 'react';
import type { PrComment } from '@goodboy/types';
import type { ResolverActionKind } from '../../resolverActions';
import type { ResolverRunningThreadAction } from '../../hooks/useResolverActions';
import type { ResolverThreadSettlement } from '../../resolverThreadSettlements';
import { resolverThreadDecisions } from '../../resolverThreadDecisions';
import { resolverReplySummary } from '../../resolverReplySummary';
import { prCommentLocation } from '../../pr-comment-location';
import { ResolverThreadCardHeader } from './ResolverThreadCardHeader';
import { ResolverThreadComment } from './ResolverThreadComment';
import { ResolverThreadDecisions } from './ResolverThreadDecisions';
import { ResolverThreadReply } from './ResolverThreadReply';

type Props = {
  readonly settlement: ResolverThreadSettlement;
  readonly comment: PrComment | null;
  readonly position: number;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
  readonly canAct: boolean;
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
  runningThreadAction,
  onRun,
  onReplyChange,
  onOpenThread,
}: Props) => {
  const initial = settlement.reason ?? settlement.reply ?? '';
  const [edited, setEdited] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const text = edited ?? initial;
  const runningKind =
    runningThreadAction?.threadId === settlement.threadId ? runningThreadAction.kind : null;
  const isEditable = canAct && !settlement.isClosed;
  const isCollapsible = settlement.isClosed;
  const isOpen = !isCollapsible || isExpanded;
  const plan = resolverThreadDecisions({ settlement, prNumber, isBusy });
  const draftedReply =
    settlement.reply !== null && settlement.reply !== initial ? settlement.reply : null;
  const summary = resolverReplySummary({ text: initial !== '' ? initial : (comment?.body ?? '') });

  return (
    <li
      className="flex min-w-0 flex-col gap-2 rounded-md bg-muted/20 p-3"
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
      {isOpen && comment !== null && (
        <ResolverThreadComment
          author={comment.author}
          location={prCommentLocation({ comment })}
          body={comment.body}
        />
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
      {isOpen && isEditable && (
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
