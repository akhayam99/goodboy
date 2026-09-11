import { Chip } from '@goodboy/ui';
import { describeBitbucketPrState } from './bitbucketPrPresentation';
import { stateDescription } from '../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
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
      tone={presentation.tone}
      size="xs"
      bordered={false}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      label={presentation.label}
      title={description}
      ariaLabel={description}
    />
  );
};
