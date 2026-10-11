import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { fixedInLine, OUTCOME_ACTION } from '../../commentOutcomeCopy';
import { replyOf } from '../../reviewRows';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { useOutcomeRun } from './useOutcomeRun';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly sha: string;
  readonly isNote: boolean;
};

export const OutcomeFixed = ({ sessionId, entry, sha, isNote }: Props) => {
  const publishThreadNow = useAppStore((s) => s.publishThreadNow);
  const draft = useAppStore((s) => s.resolveItemDrafts[sessionId]?.[entry.threadId]);
  const { isBusy, error, run } = useOutcomeRun();
  const hasReply = replyOf({ draft, row: entry.row }).trim() !== '';
  const isPosted = entry.row.thread.replyPostedAt !== null;
  const canPost = !isNote && hasReply && !isPosted;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-meta text-muted-foreground">{fixedInLine({ sha })}</p>
      {canPost && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            isBusy={isBusy}
            onClick={() =>
              void run(() => publishThreadNow({ sessionId, threadId: entry.threadId }))
            }
          >
            {OUTCOME_ACTION.postReply}
          </Button>
        </div>
      )}
      {error !== null && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
