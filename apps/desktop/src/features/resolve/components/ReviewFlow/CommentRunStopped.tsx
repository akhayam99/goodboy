import { Button, Notice } from '@goodboy/ui';
import { COMMENT_RUN_COPY } from '../../commentRunCopy';
import type { CommentRunView } from '../../commentRunViewsOf';

type Props = {
  readonly run: CommentRunView;
  readonly onOpenRun: () => void;
};

export const CommentRunStopped = ({ run, onOpenRun }: Props) => (
  <section
    aria-label={COMMENT_RUN_COPY.runLine({ title: run.title })}
    data-comment-run={run.agentId}
    data-comment-run-end="stopped"
    className="flex min-w-0 flex-col"
  >
    <Notice
      tone="info"
      placement="inline"
      title={COMMENT_RUN_COPY.stoppedTitle}
      body={COMMENT_RUN_COPY.stoppedBody}
      actions={
        <Button size="sm" variant="ghost" onClick={onOpenRun}>
          {COMMENT_RUN_COPY.openRun}
        </Button>
      }
    />
  </section>
);
