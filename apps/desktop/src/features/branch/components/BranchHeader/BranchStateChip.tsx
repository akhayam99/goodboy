import { PULL_REQUEST_NOUNS } from '@goodboy/core/review-source';
import type { PullRequestHost } from '@goodboy/types';
import { Chip, ICON_SIZE } from '@goodboy/ui';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../../shared/utils/pullRequestPresentation';
import { pullRequestStateWordOf } from '../../pullRequestStateWordOf';

type Props = {
  readonly state: PullRequestPresentationState;
  readonly host: PullRequestHost;
};

export const BranchStateChip = ({ state, host }: Props) => {
  const presentation = PULL_REQUEST_PRESENTATION[state];
  const Icon = presentation.icon;
  const word = pullRequestStateWordOf({ state }) ?? `No ${PULL_REQUEST_NOUNS[host].long}`;
  return (
    <span
      data-slot="branch-state"
      data-state={state}
      data-tone={presentation.tone}
      className="inline-flex shrink-0 items-center"
    >
      <Chip
        kind="state"
        tone={presentation.tone}
        emphasis="subtle"
        bordered={false}
        icon={<Icon size={ICON_SIZE.row} aria-hidden />}
        label={word}
      />
    </span>
  );
};
