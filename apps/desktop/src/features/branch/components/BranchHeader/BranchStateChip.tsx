import { PULL_REQUEST_NOUNS } from '@goodboy/core/review-source';
import type { PullRequestHost } from '@goodboy/types';
import { ICON_SIZE } from '@goodboy/ui';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../../shared/utils/pullRequestPresentation';
import { pullRequestStateWordOf } from '../../pullRequestStateWordOf';

type Props = {
  readonly state: PullRequestPresentationState;
  readonly host: PullRequestHost;
  readonly isIconOnly?: boolean;
};

export const BranchStateChip = ({ state, host, isIconOnly = false }: Props) => {
  const presentation = PULL_REQUEST_PRESENTATION[state];
  const Icon = presentation.icon;
  const word = pullRequestStateWordOf({ state }) ?? `No ${PULL_REQUEST_NOUNS[host].long}`;
  if (isIconOnly) {
    return (
      <span
        data-slot="branch-state"
        data-state={state}
        data-tone={presentation.tone}
        role="img"
        aria-label={word}
        title={word}
        className="inline-flex shrink-0 items-center"
      >
        <Icon size={ICON_SIZE.row} aria-hidden className={presentation.textClass} />
      </span>
    );
  }
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
