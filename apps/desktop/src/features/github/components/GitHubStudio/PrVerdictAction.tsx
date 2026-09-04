import { useState } from 'react';
import { AnchoredPopover, Button, Select, Textarea, useDropdown } from '@goodboy/ui';
import { CheckCircle2 } from 'lucide-react';
import type { PublishPrReviewVerdict } from '../../../../store/slices/review-drafts/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

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
  const dropdown = useDropdown({
    disabled: canReview === false || isBusy,
    width: 'w-72',
    expectedHeight: 260,
  });
  const { close } = dropdown;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Submit a review"
      className="flex flex-col gap-2 p-3"
      hasBackdrop
      trigger={
        <Button
          variant="secondary"
          emphasis="outline"
          size="sm"
          onClick={dropdown.toggle}
          disabled={canReview === false || isBusy}
          isBusy={isSubmitting}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          title={
            canReview
              ? 'Approve or request changes on this pull request'
              : 'Could not read the repository from the pull request link'
          }
          className="text-foreground"
        >
          <CheckCircle2 size={ICON_SIZE.row} aria-hidden />
          Review
        </Button>
      }
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
    </AnchoredPopover>
  );
};
