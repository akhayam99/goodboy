import { Eye } from '@goodboy/ui/icons';
import { AnchoredPopover, Button, ICON_SIZE, useDropdown } from '@goodboy/ui';
import type { PrReviewDraft, SessionId } from '@goodboy/types';
import type { MountReview } from '../../mountReviewOf';
import { WriteReviewForm } from './WriteReviewForm';

type Props = {
  readonly sessionId: SessionId;
  readonly review: MountReview;
  readonly drafts: ReadonlyArray<PrReviewDraft>;
};

const REVIEW_PANEL_LABEL = 'Review changes';

export const ReviewPanelButton = ({ sessionId, review, drafts }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-[480px]',
    expectedHeight: 360,
    expectedWidth: 480,
  });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={REVIEW_PANEL_LABEL}
      className="flex flex-col p-4"
      trigger={
        <Button
          size="sm"
          variant="secondary"
          onClick={dropdown.toggle}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
        >
          <Eye size={ICON_SIZE.row} aria-hidden />
          Review
          <span className="tabular-nums text-muted-foreground">{drafts.length}</span>
        </Button>
      }
    >
      <WriteReviewForm sessionId={sessionId} review={review} drafts={drafts} variant="panel" />
    </AnchoredPopover>
  );
};
