import { Button, StateDot } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { agentPlace } from '../../../../store/slices/navigation/place';
import { COMMENT_RUN_COPY } from '../../commentRunCopy';
import type { CommentRunView } from '../../commentRunViewsOf';
import { CommentRunOutcome } from './CommentRunOutcome';
import { CommentRunStopped } from './CommentRunStopped';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: Pick<ReviewEntry, 'threadId' | 'run' | 'resolveWord' | 'row'>;
  readonly hostLabel: string;
};

type DetailParams = {
  readonly run: CommentRunView;
};

const stripDetailOf = ({ run }: DetailParams): string => {
  const word = run.end === 'finished' ? COMMENT_RUN_COPY.finished : run.stateWord;
  const count = run.threadIds.length;
  return count > 1 ? `${word} · ${COMMENT_RUN_COPY.inThisRun({ count })}` : word;
};

export const CommentRunStrip = ({ sessionId, entry, hostLabel }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const { run, threadId, resolveWord: word } = entry;
  if (run === null) {
    return null;
  }
  const isNote = entry.row.thread.originKind === 'diff_comment';
  const openRun = () => navigate({ to: agentPlace({ sessionId, agentId: run.agentId }) });
  if (run.end === 'stopped') {
    return <CommentRunStopped run={run} onOpenRun={openRun} />;
  }
  return (
    <section
      aria-label={COMMENT_RUN_COPY.runLine({ title: run.title })}
      data-comment-run={run.agentId}
      data-comment-run-end={run.end}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-subtle p-4 ring-1 ring-border-soft">
        <div className="flex min-w-0 items-center gap-2">
          <StateDot state={run.dot} label={run.stateWord} isLive={run.dot === 'running'} />
          <span className="min-w-0 flex-1 truncate text-row text-foreground">{run.title}</span>
          <Button size="sm" variant="ghost" onClick={openRun}>
            {COMMENT_RUN_COPY.openRun}
          </Button>
        </div>
        <p className="min-w-0 truncate text-meta text-muted-foreground">{stripDetailOf({ run })}</p>
      </div>
      {run.end === 'working' ? (
        <p className="text-meta text-faint-foreground">
          {isNote ? COMMENT_RUN_COPY.workingLocal : COMMENT_RUN_COPY.workingHost}
        </p>
      ) : (
        <CommentRunOutcome
          sessionId={sessionId}
          threadId={threadId}
          run={run}
          word={word}
          isNote={isNote}
          hostLabel={hostLabel}
        />
      )}
    </section>
  );
};
