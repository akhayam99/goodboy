import { PULL_REQUEST_NOUNS } from '@goodboy/core';
import type { PullRequestHost } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../../shared/pullRequestPresentation';
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
      className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"
    >
      <Icon size={ICON_SIZE.row} aria-hidden className={presentation.textClass} />
      {word}
    </span>
  );
};
