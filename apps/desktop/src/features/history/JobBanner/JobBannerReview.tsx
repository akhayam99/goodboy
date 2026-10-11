import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { HistoryChangeDiff } from '../../diff/HistoryChangeDiff';
import { useHistoryChangeReview } from '../hooks/useHistoryChangeReview';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export const JobBannerReview = ({ sessionId, mountId }: Props) => {
  const review = useHistoryChangeReview({ sessionId, mountId });
  if (!review.canReview || review.copyPath === null) {
    return null;
  }
  if (!review.isExpanded) {
    return (
      <div className="flex">
        <Button size="sm" variant="ghost" isBusy={review.isPending} onClick={review.open}>
          Review the change
        </Button>
      </div>
    );
  }
  return (
    <section aria-label="Review the change" className="flex min-w-0 flex-col gap-3">
      <p className="text-meta text-muted-foreground">These changes were outside the plan.</p>
      <div className="flex h-96 min-h-0 flex-col">
        <HistoryChangeDiff files={review.files} sessionId={sessionId} copyPath={review.copyPath} />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" isBusy={review.isPending} onClick={review.accept}>
          Accept and apply
        </Button>
        <Button size="sm" variant="ghost" disabled={review.isPending} onClick={review.discard}>
          Discard
        </Button>
      </div>
    </section>
  );
};
