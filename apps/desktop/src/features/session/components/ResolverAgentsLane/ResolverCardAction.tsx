import { useState } from 'react';
import { cn } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useResolverActions } from '../../hooks/useResolverActions';
import type { ResolverStatus } from '../../resolver-linkage';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import { resolverActionOpensPanel, type ResolverActionRole } from '../../resolverActions';
import { ResolverConfirm } from '../ResolverConfirm';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
  readonly commitSha: string | null;
  readonly isQueueStalled: boolean;
  readonly hasOtherActiveResolvers: boolean;
  readonly onOpenPanel: () => void;
};

const ROLE_CLASS: Record<ResolverActionRole, string> = {
  primary: 'border-info/40 text-info hover:bg-info/10',
  alert: 'border-warning/40 text-warning hover:bg-warning/10',
  danger: 'border-danger/40 text-danger hover:bg-danger/10',
  neutral: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
};

const BUTTON_CLASS =
  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export const ResolverCardAction = ({
  agent,
  sessionId,
  status,
  commitSha,
  isQueueStalled,
  hasOtherActiveResolvers,
  onOpenPanel,
}: Props) => {
  const actions = useResolverActions({
    agent,
    sessionId,
    status,
    commitSha,
    isQueueStalled,
    hasOtherActiveResolvers,
  });
  const [isArmed, setIsArmed] = useState(false);
  const action = actions.plan.primary;

  if (action === null) {
    return null;
  }
  const Icon = RESOLVER_ACTION_ICON[action.kind];

  return (
    <div
      className="flex min-w-0 flex-col items-end gap-2"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {!isArmed && (
        <button
          type="button"
          disabled={!action.isEnabled}
          onClick={() => {
            if (resolverActionOpensPanel({ action })) {
              onOpenPanel();
              return;
            }
            if (action.confirm === null) {
              void actions.run(action.kind);
              return;
            }
            setIsArmed(true);
          }}
          className={cn(BUTTON_CLASS, ROLE_CLASS[action.role])}
        >
          <Icon size={9} aria-hidden />
          {action.label}
        </button>
      )}
      {isArmed && (
        <ResolverConfirm
          action={action}
          explanation={actions.explanation}
          threadCount={actions.threadCount}
          className="w-full max-w-72 self-end"
          onExplanationChange={actions.setExplanation}
          onConfirm={async () => {
            await actions.run(action.kind);
            setIsArmed(false);
          }}
          onCancel={() => setIsArmed(false)}
        />
      )}
    </div>
  );
};
