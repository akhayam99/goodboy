import { useState } from 'react';
import { Textarea } from '@goodboy/ui';
import { GhostActionButton } from '@goodboy/ui';
import { RESOLVER_ACTION_BUSY_LABEL } from '../../resolverActionBusyLabel';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import { RESOLVER_ACTION_TONE } from '../../resolverActionTone';
import type { ResolverActionKind } from '../../resolverActions';
import type {
  ResolverThreadDecisionPlan,
  ResolverThreadNotes,
} from '../../resolverThreadDecisions';
import { ResolverConfirm } from '../ResolverConfirm';

type Props = {
  readonly plan: ResolverThreadDecisionPlan;
  readonly ariaScope: string;
  readonly isReplyEmpty: boolean;
  readonly runningKind: ResolverActionKind | null;
  readonly isFrozen: boolean;
  readonly onRun: (params: {
    readonly kind: ResolverActionKind;
    readonly notes: string;
  }) => Promise<void>;
};

const NEEDS_REPLY: ReadonlyArray<ResolverActionKind> = ['explain', 'forceResolve'];

const NOTES_PLACEHOLDER: Record<Exclude<ResolverThreadNotes, 'none'>, string> = {
  required: 'What should it do instead?',
  optional: 'Hints, optional',
};

export const ResolverThreadDecisions = ({
  plan,
  ariaScope,
  isReplyEmpty,
  runningKind,
  isFrozen,
  onRun,
}: Props) => {
  const [armed, setArmed] = useState<ResolverActionKind | null>(null);
  const [writing, setWriting] = useState<ResolverActionKind | null>(null);
  const [notes, setNotes] = useState('');

  if (plan.decisions.length === 0) {
    return null;
  }

  const armedDecision = plan.decisions.find(({ action }) => action.kind === armed) ?? null;
  const writingDecision = plan.decisions.find(({ action }) => action.kind === writing) ?? null;
  const isBlocked = ({ kind }: { readonly kind: ResolverActionKind }): boolean =>
    NEEDS_REPLY.includes(kind) && isReplyEmpty;

  const send = async ({ kind }: { readonly kind: ResolverActionKind }) => {
    await onRun({ kind, notes });
    setArmed(null);
    setWriting(null);
    setNotes('');
  };

  if (armedDecision !== null) {
    return (
      <ResolverConfirm
        action={armedDecision.action}
        isBusy={runningKind === armedDecision.action.kind}
        onConfirm={() => send({ kind: armedDecision.action.kind })}
        onCancel={() => setArmed(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {writingDecision !== null && (
        <div className="flex flex-col gap-1">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            aria-label={
              writingDecision.notes === 'required'
                ? `Instructions for ${ariaScope}`
                : `Optional hints for ${ariaScope}`
            }
            placeholder={
              NOTES_PLACEHOLDER[writingDecision.notes === 'required' ? 'required' : 'optional']
            }
            autoFocus
            autoGrow
            maxRows={8}
            className="resize-none bg-background/60 px-2 py-1.5 text-xs leading-relaxed"
          />
          <div className="flex items-center justify-end gap-1">
            <GhostActionButton
              icon={RESOLVER_ACTION_ICON[writingDecision.action.kind]}
              label="Send"
              tone="info"
              disabled={
                (writingDecision.notes === 'required' && notes.trim() === '') ||
                (isFrozen && runningKind !== writingDecision.action.kind)
              }
              isBusy={runningKind === writingDecision.action.kind}
              busyLabel={RESOLVER_ACTION_BUSY_LABEL[writingDecision.action.kind]}
              onClick={() => void send({ kind: writingDecision.action.kind })}
            />
            <GhostActionButton
              icon={RESOLVER_ACTION_ICON.dequeue}
              label="Cancel"
              onClick={() => {
                setWriting(null);
                setNotes('');
              }}
            />
          </div>
        </div>
      )}
      {writingDecision === null && (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {plan.decisions.map(({ action, hint, notes: notesMode, isRecommended, lockReason }) => (
            <GhostActionButton
              key={action.kind}
              icon={RESOLVER_ACTION_ICON[action.kind]}
              label={action.label}
              tone={RESOLVER_ACTION_TONE[action.role]}
              highlighted={isRecommended}
              isBusy={runningKind === action.kind}
              busyLabel={RESOLVER_ACTION_BUSY_LABEL[action.kind]}
              disabled={
                !action.isEnabled ||
                isBlocked({ kind: action.kind }) ||
                (isFrozen && runningKind !== action.kind)
              }
              title={
                lockReason !== null
                  ? `${lockReason}.`
                  : isBlocked({ kind: action.kind })
                    ? 'Write the reply to post first'
                    : `${hint}.`
              }
              onClick={() => {
                if (notesMode !== 'none') {
                  setWriting(action.kind);
                  return;
                }
                if (action.confirm === null) {
                  void send({ kind: action.kind });
                  return;
                }
                setArmed(action.kind);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
