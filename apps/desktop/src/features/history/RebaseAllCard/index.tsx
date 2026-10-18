import { useMemo } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { distanceBehind } from '../../../shared/lib/gitStatus';
import { useRebaseStatuses } from '../useRebaseStatuses';
import { useActionControls } from '../../actions/useActionControls';
import type { SessionActionTarget } from '../../actions/types';
import { RebasePromptVerb } from '../components/RebasePromptVerb';
import { RebaseAllBranchLine } from './RebaseAllBranchLine';
import { rebaseAllSummaryOf } from './rebaseAllLineOf';

type Props = {
  readonly sessionId: SessionId;
};

const REBASE_ALL_ID = 'session.rebaseAll';
const ABORT_ID = 'session.abortRebaseAll';

export const RebaseAllCard = ({ sessionId }: Props) => {
  const run = useAppStore((s) => s.rebaseAllRuns[sessionId] ?? null);
  const dismissRebaseAll = useAppStore((s) => s.dismissRebaseAll);
  const statuses = useRebaseStatuses({ sessionId });
  const target = useMemo<SessionActionTarget>(() => ({ kind: 'session', sessionId }), [sessionId]);
  const controls = useActionControls({ target });
  const rebaseAllAction = controls.actions.find((action) => action.id === REBASE_ALL_ID);
  const abortAction = controls.actions.find((action) => action.id === ABORT_ID);
  if (run === null) {
    if (rebaseAllAction === undefined) {
      return null;
    }
    return (
      <div data-rebase-all="" className="flex min-h-7 min-w-0 items-center gap-2 px-1 text-ui">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {rebaseAllAction.description}
        </span>
        <RebasePromptVerb
          controls={controls}
          action={rebaseAllAction}
          label="Rebase all"
          variant="secondary"
        />
      </div>
    );
  }
  return (
    <section
      data-rebase-all=""
      data-phase={run.phase}
      aria-label="Rebase all"
      className="flex min-w-0 flex-col gap-1 px-1"
    >
      <div className="flex min-h-7 min-w-0 items-center gap-2 text-ui">
        <span role="status" className="min-w-0 flex-1 truncate text-foreground">
          {rebaseAllSummaryOf({ run })}
        </span>
        {run.phase === 'running' ? (
          <RebasePromptVerb
            controls={controls}
            action={abortAction}
            label="Abort"
            variant="ghost"
          />
        ) : (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => dismissRebaseAll({ sessionId, runId: run.id })}
          >
            Dismiss
          </Button>
        )}
      </div>
      <ul className="flex min-w-0 flex-col">
        {run.branches.map((branch) => {
          const status = statuses.get(branch.mountId) ?? null;
          return (
            <RebaseAllBranchLine
              key={branch.mountId}
              branch={branch}
              behind={status === null ? null : distanceBehind({ distance: status.mainDistance })}
              isRebasingHere={status?.inProgress === 'rebase'}
            />
          );
        })}
      </ul>
    </section>
  );
};
