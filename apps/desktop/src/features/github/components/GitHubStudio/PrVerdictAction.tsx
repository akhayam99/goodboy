import { useState } from 'react';
import { Button, cn, DropdownBackdrop, Popover, Select, Textarea, useDropdown } from '@goodboy/ui';
import { CheckCircle2 } from 'lucide-react';
import type { PublishPrReviewVerdict } from '../../../../store/slices/review-drafts/types';

export type PrVerdictSubmission = {
  readonly verdict: PublishPrReviewVerdict;
  readonly body: string;
};

type Props = {
  readonly canReview: boolean;
  readonly isBusy: boolean;
  readonly isSubmitting: boolean;
  readonly onSubmit: (submission: PrVerdictSubmission) => void;
};

export const PrVerdictAction = ({ canReview, isBusy, isSubmitting, onSubmit }: Props) => {
  const [verdict, setVerdict] = useState<PublishPrReviewVerdict>('approve');
  const [body, setBody] = useState('');
  const needsSummary = verdict !== 'approve';
  const canSubmit = needsSummary === false || body.trim() !== '';
  const {
    open: isOpen,
    close,
    toggle,
    containerRef,
    popupRef,
    popupClassName,
  } = useDropdown({
    disabled: canReview === false || isBusy,
    width: 'w-72',
    expectedHeight: 260,
    hasBackdrop: true,
  });

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        emphasis="outline"
        size="sm"
        onClick={toggle}
        disabled={canReview === false || isBusy}
        isBusy={isSubmitting}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={
          canReview
            ? 'Approve or request changes on this pull request'
            : 'Could not read the repository from the pull request link'
        }
        className="text-foreground"
      >
        <CheckCircle2 size={13} aria-hidden />
        Review
      </Button>
      {isOpen && (
        <>
          <DropdownBackdrop onClose={close} />
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel="Submit a review"
            className={cn(popupClassName, 'flex flex-col gap-2 p-3')}
          >
            <Select
              size="sm"
              block
              aria-label="Review verdict"
              value={verdict}
              onChange={(event) => setVerdict(event.target.value as PublishPrReviewVerdict)}
            >
              <option value="approve">Approve</option>
              <option value="request_changes">Request changes</option>
              <option value="comment">Comment</option>
            </Select>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Review summary"
              aria-label="Review summary"
              autoGrow
              minRows={2}
              maxRows={6}
              className="text-xs"
            />
            {canSubmit === false && (
              <p className="text-2xs text-muted-foreground">
                Approve is the only verdict that posts without a summary
              </p>
            )}
            <Button
              size="sm"
              disabled={canSubmit === false}
              onClick={() => {
                onSubmit({ verdict, body });
                setBody('');
                close();
              }}
            >
              Submit review
            </Button>
          </Popover>
        </>
      )}
    </div>
  );
};
