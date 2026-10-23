import { useMemo } from 'react';
import { Button, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { TRAIL_PILL_INSET } from '../../../shared/components/trailingSlot';
import { useActionControls } from '../../actions/useActionControls';
import type { SessionActionTarget } from '../../actions/types';
import { RebasePromptVerb } from '../components/RebasePromptVerb';
import { rebaseAllSummaryOf } from './rebaseAllSummaryOf';

type Props = {
  readonly sessionId: SessionId;
};

const REBASE_ALL_ID = 'session.rebaseAll';
const ABORT_ID = 'session.abortRebaseAll';

const LINE_CLASS = 'flex min-h-7 min-w-0 items-center gap-2 pl-1 text-ui';

const TRAIL_CLASS = 'flex shrink-0 items-center';

export const RebaseAllCard = ({ sessionId }: Props) => {
  const run = useAppStore((s) => s.rebaseAllRuns[sessionId] ?? null);
  const dismissRebaseAll = useAppStore((s) => s.dismissRebaseAll);
  const target = useMemo<SessionActionTarget>(() => ({ kind: 'session', sessionId }), [sessionId]);
  const controls = useActionControls({ target });
  const rebaseAllAction = controls.actions.find((action) => action.id === REBASE_ALL_ID);
  const abortAction = controls.actions.find((action) => action.id === ABORT_ID);
  if (run === null) {
    if (rebaseAllAction === undefined) {
      return null;
    }
    return (
      <div data-rebase-all="" className={LINE_CLASS}>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {rebaseAllAction.description}
        </span>
        <span data-trail-slot="" className={cn(TRAIL_CLASS, TRAIL_PILL_INSET)}>
          <RebasePromptVerb
            controls={controls}
            action={rebaseAllAction}
            label="Rebase all"
            variant="secondary"
          />
        </span>
      </div>
    );
  }
  return (
    <div data-rebase-all="" data-phase={run.phase} className={LINE_CLASS}>
      <span role="status" className="min-w-0 flex-1 truncate text-foreground">
        {rebaseAllSummaryOf({ run })}
      </span>
      {run.phase === 'running' ? (
        <span data-trail-slot="" className={TRAIL_CLASS}>
          <RebasePromptVerb
            controls={controls}
            action={abortAction}
            label="Abort"
            variant="ghost"
            className={TRAIL_PILL_INSET}
          />
        </span>
      ) : run.phase === 'handing' ? null : (
        <span data-trail-slot="" className={TRAIL_CLASS}>
          <Button
            size="sm"
            variant="ghost"
            className={TRAIL_PILL_INSET}
            onClick={() => dismissRebaseAll({ sessionId, runId: run.id })}
          >
            Dismiss
          </Button>
        </span>
      )}
    </div>
  );
};
