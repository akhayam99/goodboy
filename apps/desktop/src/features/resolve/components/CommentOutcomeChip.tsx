import { Chip } from '@goodboy/ui';
import type { CommentOutcome } from '../commentOutcome';
import { OUTCOME_LABEL, OUTCOME_TONE } from '../commentOutcomeCopy';

type Props = {
  readonly outcome: CommentOutcome;
  readonly onOpen?: () => void;
};

export const CommentOutcomeChip = ({ outcome, onOpen }: Props) => {
  const label = OUTCOME_LABEL[outcome.kind];
  if (onOpen === undefined) {
    return <Chip tone={OUTCOME_TONE[outcome.kind]} label={label} />;
  }
  return (
    <Chip
      as="button"
      tone={OUTCOME_TONE[outcome.kind]}
      label={label}
      ariaLabel={`${label}. Open in Fix comments`}
      onClick={onOpen}
    />
  );
};
