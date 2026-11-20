import { useMemo } from 'react';
import { SegmentedTabs } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ReviewTarget } from '../../../../store/slices/review-drafts/resolveReviewTarget';
import type { MountReview } from '../../mountReviewOf';
import { reviewTargetLabelOf } from '../../reviewTargetLabelOf';

type Props = {
  readonly sessionId: SessionId;
  readonly review: MountReview;
};

type TargetParams = {
  readonly target: ReviewTarget;
};

type ChooseParams = {
  readonly key: string;
};

const TARGET_CHOICE_LABEL = 'Review goes to';

const targetKeyOf = ({ target }: TargetParams): string =>
  `${target.provider}|${target.repo}|${target.prNumber}`;

export const ReviewTargetChooser = ({ sessionId, review }: Props) => {
  const setReviewSubmission = useAppStore((s) => s.setReviewSubmission);
  const choiceOptions = useMemo(
    () =>
      review.choices.map((choice) => ({
        value: targetKeyOf({ target: choice }),
        label: reviewTargetLabelOf({ target: choice }),
      })),
    [review.choices],
  );
  const onChoose = ({ key }: ChooseParams): void => {
    const chosenTarget = review.choices.find((choice) => targetKeyOf({ target: choice }) === key);
    if (chosenTarget !== undefined) {
      setReviewSubmission({ sessionId, patch: { chosenTarget } });
    }
  };

  if (review.choices.length < 2 || review.target === null) {
    return null;
  }
  return (
    <div className="w-fit">
      <SegmentedTabs<string>
        size="sm"
        options={choiceOptions}
        value={targetKeyOf({ target: review.target })}
        onChange={(key) => onChoose({ key })}
        ariaLabel={TARGET_CHOICE_LABEL}
      />
    </div>
  );
};
