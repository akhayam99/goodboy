import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Textarea, cn } from '@goodboy/ui';
import type { PrComment } from '@goodboy/types';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import type { ResolverAction, ResolverActionKind } from '../../resolverActions';
import type { ResolverThreadSettlement } from '../../resolverThreadSettlements';
import { resolverThreadActions } from '../../resolverThreadActions';
import { prCommentLocation } from '../../pr-comment-location';
import { CommentSnippet } from '../CommentSnippet';
import { ResolverConfirm } from '../ResolverConfirm';
import { ResolverOutcomeChip } from './ResolverOutcomeChip';

type Props = {
  readonly settlement: ResolverThreadSettlement;
  readonly comment: PrComment | null;
  readonly position: number;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
  readonly canAct: boolean;
  readonly canForceResolve: boolean;
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

const BUTTON_CLASS =
  'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const ROLE_CLASS = {
  primary: 'text-info hover:bg-info/10',
  alert: 'text-warning hover:bg-warning/10',
  danger: 'text-danger hover:bg-danger/10',
  neutral: 'text-muted-foreground hover:bg-muted hover:text-foreground',
} satisfies Record<ResolverAction['role'], string>;

export const ResolverThreadRow = ({
  settlement,
  comment,
  position,
  prNumber,
  isBusy,
  canAct,
  canForceResolve,
  onRun,
  onReplyChange,
  onOpenThread,
}: Props) => {
  const initial = settlement.reason ?? settlement.reply ?? '';
  const [edited, setEdited] = useState<string | null>(null);
  const [armed, setArmed] = useState<ResolverActionKind | null>(null);
  const text = edited ?? initial;
  const isEditable = canAct && !settlement.isClosed;
  const plan = resolverThreadActions({ settlement, prNumber, isBusy });
  const buttons = (isEditable ? [plan.primary, ...plan.overflow] : []).filter(
    (action): action is ResolverAction =>
      action !== null && (canForceResolve || action.kind !== 'forceResolve'),
  );
  const armedAction = buttons.find((action) => action.kind === armed) ?? null;
  const isMissingText = (action: ResolverAction): boolean =>
    NEEDS_TEXT.includes(action.kind) && text.trim() === '';

  return (
    <li className="flex flex-col gap-2 rounded-md bg-muted/20 p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <ResolverOutcomeChip kind={settlement.kind} isClosed={settlement.isClosed} />
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground/70">
          thread {position}
        </span>
        {onOpenThread !== null && (
          <button
            type="button"
            onClick={() => onOpenThread(settlement.threadId)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            Open on GitHub
            <ArrowRight size={10} aria-hidden className="opacity-70" />
          </button>
        )}
      </div>
      {comment !== null && (
        <CommentSnippet
          author={comment.author}
          location={prCommentLocation({ comment })}
          body={comment.body}
        />
      )}
      {settlement.reply !== null && settlement.reply !== initial && (
        <p className="text-2xs leading-relaxed text-muted-foreground">{settlement.reply}</p>
      )}
      {settlement.isClosed && initial !== '' && (
        <p className="text-2xs leading-relaxed text-muted-foreground">{initial}</p>
      )}
      {isEditable && (
        <Textarea
          value={text}
          onChange={(event) => setEdited(event.target.value)}
          onBlur={() => onReplyChange({ threadId: settlement.threadId, reply: text })}
          aria-label={`reply for thread ${position}`}
          placeholder={PLACEHOLDER[settlement.kind]}
          autoGrow
          maxRows={6}
          className="min-h-12 resize-none bg-background/60 px-2 py-1.5 text-xs leading-relaxed"
        />
      )}
      {armedAction !== null ? (
        <ResolverConfirm
          action={armedAction}
          onConfirm={async () => {
            await onRun({ threadId: settlement.threadId, kind: armedAction.kind, text });
            setArmed(null);
          }}
          onCancel={() => setArmed(null)}
        />
      ) : (
        buttons.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {buttons.map((action) => {
              const Icon = RESOLVER_ACTION_ICON[action.kind];
              return (
                <button
                  key={action.kind}
                  type="button"
                  disabled={!action.isEnabled || isMissingText(action)}
                  title={isMissingText(action) ? 'write the reply to post first' : undefined}
                  onClick={() => {
                    if (action.confirm === null) {
                      void onRun({ threadId: settlement.threadId, kind: action.kind, text });
                      return;
                    }
                    setArmed(action.kind);
                  }}
                  className={cn(BUTTON_CLASS, ROLE_CLASS[action.role])}
                >
                  <Icon size={10} aria-hidden />
                  {action.label}
                </button>
              );
            })}
          </div>
        )
      )}
    </li>
  );
};
