import { useState } from 'react';
import { PULL_REQUEST_NOUNS } from '@goodboy/core/review-source';
import type { ActivityItem } from '../../../../shared/components/PullRequestActivity/activityItem';
import type { ActivityFilter } from '../../../../shared/components/PullRequestActivity/activityFilters';
import { PullRequestActivity } from '../../../../shared/components/PullRequestActivity/PullRequestActivity';

type Props = {
  readonly items: ReadonlyArray<ActivityItem>;
  readonly host: 'github' | 'gitlab' | 'bitbucket';
  readonly baseBranch: string;
};

const noop = (): void => undefined;

export const HostActivity = ({ items, host, baseBranch }: Props) => {
  const [chosen, setChosen] = useState<ActivityFilter>('all');
  return (
    <PullRequestActivity
      items={items}
      nouns={PULL_REQUEST_NOUNS[host]}
      baseBranch={baseBranch}
      onOpenComments={noop}
      onOpenChecks={noop}
      chosen={chosen}
      onChoose={setChosen}
      isHeadingShown={false}
    />
  );
};
