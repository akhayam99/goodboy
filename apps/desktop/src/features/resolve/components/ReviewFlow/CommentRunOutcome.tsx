import { Textarea } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ResolveWord } from '../../commentProjection';
import { COMMENT_RUN_COPY } from '../../commentRunCopy';
import type { CommentRunView } from '../../commentRunViewsOf';
import { useResolveItemDraft } from '../../hooks/useResolveItemDraft';

type Props = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly run: CommentRunView;
  readonly word: ResolveWord;
  readonly isNote: boolean;
  readonly hostLabel: string;
};

export const CommentRunOutcome = ({ sessionId, threadId, run, word, isNote, hostLabel }: Props) => {
  const draft = useResolveItemDraft({ sessionId, threadId, proposal: run.summary });
  const isResolved = word === 'done' || word === 'replied';
  const resolvedLine = isResolved ? (
    <p data-comment-run-resolved className="text-meta text-muted-foreground">
      {COMMENT_RUN_COPY.resolvedByRun({ title: run.title })}
    </p>
  ) : null;
  if (isNote) {
    return (
      <div data-comment-run-outcome="note" className="flex min-w-0 flex-col gap-2">
        <p className="flex min-w-0 items-baseline gap-2 text-meta">
          <span className="text-foreground">{COMMENT_RUN_COPY.whatRunDid}</span>
          <span className="min-w-0 truncate text-muted-foreground">
            {COMMENT_RUN_COPY.keptWithNote}
          </span>
        </p>
        <p className="min-w-0 whitespace-pre-wrap rounded-lg bg-subtle px-4 py-3 text-ui text-foreground">
          {run.summary ?? COMMENT_RUN_COPY.noSummary}
        </p>
        {resolvedLine}
      </div>
    );
  }
  if (word !== 'run_finished') {
    return resolvedLine;
  }
  return (
    <label data-comment-run-outcome="host" className="flex min-w-0 flex-col gap-2">
      <span className="flex min-w-0 items-baseline gap-2 text-meta">
        <span className="text-foreground">{COMMENT_RUN_COPY.reply}</span>
        <span className="min-w-0 truncate text-muted-foreground">
          {COMMENT_RUN_COPY.draftedReply({ label: hostLabel })}
        </span>
      </span>
      <Textarea
        autoGrow
        minRows={3}
        value={draft.reply}
        onChange={(event) => draft.setReply(event.target.value)}
      />
    </label>
  );
};
