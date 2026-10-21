import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { useAutoTreeActions } from '../../../auto/chat/useAutoTreeActions';
import type { ActionCardModel } from '../next/actionCardsOf';
import type { ActionCardActions } from '../next/useActionCardActions';
import type { LiveAutoGroup } from './liveGroupsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveAutoGroup;
  readonly card: ActionCardModel | null;
  readonly view: AutoTreeView | null;
  readonly actionsFor: ActionCardActions['actionsFor'];
};

export const StuckActions = ({ sessionId, group, card, view, actionsFor }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const treeActions = useAutoTreeActions({ sessionId });
  const actions = card === null ? null : actionsFor({ card });
  const canRetry = card?.source.kind === 'auto' && card.source.target.canRetry;
  const retry = canRetry ? (actions?.main ?? null) : null;
  const stopFailure =
    treeActions.failure === null
      ? null
      : `${treeActions.failure.title}. ${treeActions.failure.message}`;
  const failures = [actions?.failure ?? null, stopFailure].filter((failure) => failure !== null);
  return (
    <div data-now-actions="" className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {retry === null ? null : (
          <Button
            variant="secondary"
            size="sm"
            aria-label={retry.ariaLabel}
            isBusy={retry.isBusy}
            disabled={retry.isDisabled}
            onClick={retry.run}
          >
            {retry.label}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          aria-label="Answer Auto in its chat"
          onClick={() =>
            navigate({ to: agentPlace({ sessionId, agentId: group.group.rootAgentId }) })
          }
        >
          Answer
        </Button>
        {view === null ? null : (
          <Button
            variant="secondary"
            size="sm"
            aria-label="Stop Auto and its agents"
            isBusy={treeActions.isStopping}
            onClick={() => void treeActions.stop({ view })}
          >
            Stop
          </Button>
        )}
      </div>
      {failures.length === 0 ? null : (
        <p role="alert" className="text-meta text-danger">
          {failures.join(' ')}
        </p>
      )}
    </div>
  );
};
