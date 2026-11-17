import { Button, StateDot } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { agentPlace } from '../../../../store/slices/navigation/place';
import { COMMENT_RUN_COPY } from '../../commentRunCopy';
import type { CommentRunView } from '../../commentRunViewsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly run: CommentRunView;
  readonly isNote: boolean;
};

export const CommentRunStrip = ({ sessionId, run, isNote }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const count = run.threadIds.length;
  const detail =
    count > 1 ? `${run.stateWord} · ${COMMENT_RUN_COPY.inThisRun({ count })}` : run.stateWord;
  return (
    <section
      aria-label={COMMENT_RUN_COPY.runLine({ title: run.title })}
      data-comment-run={run.agentId}
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <StateDot state={run.dot} label={run.stateWord} isLive={run.dot === 'running'} />
          <span className="min-w-0 flex-1 truncate text-row text-foreground">{run.title}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate({ to: agentPlace({ sessionId, agentId: run.agentId }) })}
          >
            {COMMENT_RUN_COPY.openRun}
          </Button>
        </div>
        <p className="min-w-0 truncate text-meta text-muted-foreground">{detail}</p>
      </div>
      {run.isFinished ? null : (
        <p className="text-meta text-faint-foreground">
          {isNote ? COMMENT_RUN_COPY.workingLocal : COMMENT_RUN_COPY.workingHost}
        </p>
      )}
    </section>
  );
};
