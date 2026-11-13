import type { RecordSection } from '../../../../shared/components/StudioDetail/RecordSections/types';
import type { ActivityItem } from '../../../../shared/components/PullRequestActivity/activityItem';
import { HostActivity } from './HostActivity';

type Params = {
  readonly items: ReadonlyArray<ActivityItem>;
  readonly host: 'github' | 'gitlab' | 'bitbucket';
  readonly baseBranch: string;
};

export const hostActivitySectionOf = ({
  items,
  host,
  baseBranch,
}: Params): ReadonlyArray<RecordSection> =>
  items.length === 0
    ? []
    : [
        {
          key: 'activity',
          kind: 'tool',
          label: 'Activity',
          isCollapsible: false,
          defaultOpen: true,
          content: <HostActivity items={items} host={host} baseBranch={baseBranch} />,
        },
      ];
