import { useState } from 'react';
import type { PrComment } from '@goodboy/types';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import { RESOLVER_ACTION_BUSY_LABEL } from '../../resolverActionBusyLabel';
import { RESOLVER_ACTION_TONE } from '../../resolverActionTone';
import type { ResolverAction, ResolverActionKind } from '../../resolverActions';
import type { ResolverRunningThreadAction } from '../../hooks/useResolverActions';
import type { ResolverThreadSettlement } from '../../resolverThreadSettlements';
import { resolverThreadActions } from '../../resolverThreadActions';
import { resolverReplySummary } from '../../resolverReplySummary';
import { prCommentLocation } from '../../pr-comment-location';
import { GhostActionButton } from '../../../../shared/components/GhostActionButton';
import { ResolverConfirm } from '../ResolverConfirm';
import { ResolverThreadComment } from './ResolverThreadComment';
import { ResolverThreadReply } from './ResolverThreadReply';
import { ResolverThreadRowHeader } from './ResolverThreadRowHeader';

type Props = {
  readonly settlement: ResolverThreadSettlement;
  readonly comment: PrComment | null;
  readonly position: number;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
  readonly canAct: boolean;
  readonly canForceResolve: boolean;
  readonly runningThreadAction: ResolverRunningThreadAction | null;
  readonly onRun: (params: {
    readonly threadId: string;
    readonly kind: ResolverActionKind;
    readonly text: string;
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

const NEEDS_TEXT: ReadonlyArray<ResolverActionKind> = ['explain'];

export const ResolverThreadRow = ({
  settlement,
  comment,
  position,
  prNumber,
  isBusy,
  canAct,
  canForceResolve,
  runningThreadAction,
  onRun,
  onReplyChange,
  onOpenThread,
}: Props) => {
  const initial = settlement.reason ?? settlement.reply ?? '';
  const [edited, setEdited] = useState<string | null>(null);
  const [armed, setArmed] = useState<ResolverActionKind | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const text = edited ?? initial;
  const runningKind =
    runningThreadAction?.threadId === settlement.threadId ? runningThreadAction.kind : null;
  const isEditable = canAct && !settlement.isClosed;
  const isCollapsible = settlement.isClosed;
  const isOpen = !isCollapsible || isExpanded;
  const plan = resolverThreadActions({ settlement, prNumber, isBusy });
  const buttons = (isEditable ? [plan.primary, ...plan.overflow] : []).filter(
    (action): action is ResolverAction =>
      action !== null && (canForceResolve || action.kind !== 'forceResolve'),
  );
  const armedAction = buttons.find((action) => action.kind === armed) ?? null;
  const isMissingText = (action: ResolverAction): boolean =>
    NEEDS_TEXT.includes(action.kind) && text.trim() === '';
  const draftedReply =
    settlement.reply !== null && settlement.reply !== initial ? settlement.reply : null;
  const summary = resolverReplySummary({ text: initial !== '' ? initial : (comment?.body ?? '') });

  return (
    <li className="flex flex-col gap-2 rounded-md bg-muted/20 p-2.5">
      <ResolverThreadRowHeader
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
      {armedAction !== null ? (
        <ResolverConfirm
          action={armedAction}
          isBusy={runningKind === armedAction.kind}
          onConfirm={async () => {
            await onRun({ threadId: settlement.threadId, kind: armedAction.kind, text });
            setArmed(null);
          }}
          onCancel={() => setArmed(null)}
        />
      ) : (
        buttons.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {buttons.map((action) => (
              <GhostActionButton
                key={action.kind}
                icon={RESOLVER_ACTION_ICON[action.kind]}
                label={action.label}
                tone={RESOLVER_ACTION_TONE[action.role]}
                isBusy={runningKind === action.kind}
                busyLabel={RESOLVER_ACTION_BUSY_LABEL[action.kind]}
                disabled={
                  !action.isEnabled ||
                  isMissingText(action) ||
                  (runningThreadAction !== null && runningKind !== action.kind)
                }
                title={isMissingText(action) ? 'Write the reply to post first' : undefined}
                onClick={() => {
                  if (action.confirm === null) {
                    void onRun({ threadId: settlement.threadId, kind: action.kind, text });
                    return;
                  }
                  setArmed(action.kind);
                }}
              />
            ))}
          </div>
        )
      )}
    </li>
  );
};
