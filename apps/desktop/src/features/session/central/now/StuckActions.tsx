import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { useAutoTreeActions } from '../../../auto/chat/useAutoTreeActions';
import type { LiveAutoGroup } from './liveGroupsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveAutoGroup;
  readonly view: AutoTreeView | null;
};

export const StuckActions = ({ sessionId, group, view }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const treeActions = useAutoTreeActions({ sessionId });
  const failure =
    treeActions.failure === null
      ? null
      : `${treeActions.failure.title}. ${treeActions.failure.message}`;
  return (
    <div data-now-actions="" className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
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
      {failure === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {failure}
        </p>
      )}
    </div>
  );
};
