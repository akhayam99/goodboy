import { Chip, cn } from '@goodboy/ui';
import { PULL_REQUEST_NOUNS } from '@goodboy/core';
import type { PullRequestHost } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../../shared/pullRequestPresentation';

type Props = {
  readonly state: PullRequestPresentationState;
  readonly host: PullRequestHost;
};

export const BranchStateChip = ({ state, host }: Props) => {
  const presentation = PULL_REQUEST_PRESENTATION[state];
  const Icon = presentation.icon;
  const label = state === 'none' ? `No ${PULL_REQUEST_NOUNS[host].long}` : presentation.label;
  return (
    <span
      data-slot="branch-state"
      data-state={state}
      data-tone={presentation.tone}
      className="inline-flex shrink-0"
    >
      <Chip
        tone={presentation.tone}
        kind="state"
        bordered={false}
        icon={<Icon size={ICON_SIZE.row} aria-hidden />}
        label={label}
        className={cn('shrink-0', presentation.textClass)}
      />
    </span>
  );
};
