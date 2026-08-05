import { useState } from 'react';
import { Button, cn, Popover, Select, Textarea } from '@goodboy/ui';
import { CheckCircle2 } from 'lucide-react';
import type { PublishPrReviewVerdict } from '../../../../store/slices/review-drafts/types';
import { PR_ACTION_BUTTON } from './prActionButton';

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
  const [isOpen, setIsOpen] = useState(false);
  const [verdict, setVerdict] = useState<PublishPrReviewVerdict>('approve');
  const [body, setBody] = useState('');
  const needsSummary = verdict !== 'approve';
  const canSubmit = needsSummary === false || body.trim() !== '';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={canReview === false || isBusy}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={
          canReview
            ? 'Approve or request changes on this pull request'
            : 'Could not read the repository from the pull request link'
        }
        className={cn(
          PR_ACTION_BUTTON,
          'border-border-soft text-foreground hover:border-border hover:bg-muted/50',
          isSubmitting && 'animate-border-pulse',
        )}
      >
        <CheckCircle2 size={13} aria-hidden />
        Review
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden />
          <Popover
            role="dialog"
            ariaLabel="Submit a review"
            className="absolute left-0 z-50 mt-1 flex w-72 flex-col gap-2 p-3"
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
                setIsOpen(false);
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
