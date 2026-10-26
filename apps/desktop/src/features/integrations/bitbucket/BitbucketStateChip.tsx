import { Chip, ICON_SIZE } from '@goodboy/ui';
import { describeBitbucketPrState } from './bitbucketPrPresentation';
import { stateDescription } from '../../../shared/utils/statePresentation';

import type { BitbucketPullRequestState } from './client';

type Props = {
  readonly state: BitbucketPullRequestState;
};

export const BitbucketStateChip = ({ state }: Props) => {
  const presentation = describeBitbucketPrState({ state });
  const Icon = presentation.icon;
  const description = stateDescription({ presentation });

  return (
    <Chip
      kind="state"
      tone={presentation.tone}
      bordered={false}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      label={presentation.label}
      title={description}
      ariaLabel={description}
    />
  );
};
