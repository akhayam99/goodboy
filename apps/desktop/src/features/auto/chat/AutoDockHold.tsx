import { useEffect, useRef } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { Button, StatusDot, TruncatedText } from '@goodboy/ui';
import { actionIntentOf } from '../../actions/actionIntentOf';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { AUTO_STATE_TONE } from './autoStateTone';
import { holdCardOf } from './holdCardOf';
import { useHoldActions } from './hooks/useHoldActions';
import type { AutoTreeActions } from './useAutoTreeActions';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
  readonly actions: AutoTreeActions;
};

const TONE = AUTO_STATE_TONE.waitingOnYou;

const isFocusFree = (): boolean => {
  const active = document.activeElement;
  return active === null || active === document.body;
};

export const AutoDockHold = ({ sessionId, view, rootAgent, actions }: Props) => {
  const card = holdCardOf({ view });
  const model = useHoldActions({
    sessionId,
    rootAgent,
    suggestionId: card?.suggestionId ?? null,
    workflowName: card?.workflowName ?? '',
    holdKey: `${view.tree.id}:${view.tree.phaseRev}`,
  });
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const isCard = card !== null;
  useEffect(() => {
    if (!isCard || !isFocusFree()) {
      return;
    }
    firstRef.current?.focus();
    firstRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isCard]);
  if (card === null) {
    return null;
  }
  const isStopping = actions.stoppingTreeId === view.tree.id;
  const isBusy = model.busy !== null || isStopping;
  return (
    <section
      aria-label={card.title}
      data-hold-card=""
      className="flex min-w-0 flex-col gap-2 rounded-md border border-border-soft p-3 text-meta"
    >
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot tone={TONE} size="sm" />
        <TruncatedText className="min-w-0 truncate text-ui text-foreground" tooltip={card.title}>
          {card.title}
        </TruncatedText>
      </div>
      <p className="min-w-0 text-muted-foreground">{card.reason}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {card.switchLabel === null ? null : (
          <Button
            ref={firstRef}
            variant="secondary"
            size="sm"
            isBusy={model.busy === 'switch'}
            busyLabel="Switching"
            disabled={isBusy}
            onClick={() => void model.switchRun()}
          >
            {card.switchLabel}
          </Button>
        )}
        <Button
          ref={card.switchLabel === null ? firstRef : undefined}
          variant="ghost"
          size="sm"
          isBusy={model.busy === 'continue'}
          busyLabel="Continuing"
          disabled={isBusy}
          onClick={() => void model.continueRun()}
        >
          {card.continueLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          intent={actionIntentOf({ verb: card.stopLabel })}
          isBusy={isStopping}
          busyLabel="Stopping"
          disabled={isBusy}
          onClick={() => void actions.stop({ view })}
        >
          {card.stopLabel}
        </Button>
      </div>
      {card.carryLine === null ? null : (
        <p className="min-w-0 text-faint-foreground">{card.carryLine}</p>
      )}
    </section>
  );
};
