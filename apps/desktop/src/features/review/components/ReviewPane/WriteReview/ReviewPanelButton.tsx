import { useMemo } from 'react';
import { Eye } from 'lucide-react';
import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';
import type { PrReviewDraft, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { WriteReviewForm } from './WriteReviewForm';

type Props = {
  readonly sessionId: SessionId;
};

const REVIEW_PANEL_LABEL = 'Review changes';

export const ReviewPanelButton = ({ sessionId }: Props) => {
  const drafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
  const count = useMemo(() => drafts.filter((draft) => draft.status === 'draft').length, [drafts]);
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
          <span className="tabular-nums text-muted-foreground">{count}</span>
        </Button>
      }
    >
      <WriteReviewForm sessionId={sessionId} variant="panel" />
    </AnchoredPopover>
  );
};
