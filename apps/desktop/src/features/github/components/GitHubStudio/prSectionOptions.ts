import type { PrDetail, PullRequestState } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import { FileText, ListChecks, MessageSquare } from 'lucide-react';
import { computeTabStatus } from '../../utils/compute-tab-status';
import type { PrSection } from './prSection';

type Params = {
  readonly pr: PullRequestState;
  readonly detail: PrDetail | null;
};

type CountParams = {
  readonly count: number | undefined;
};

const countBadge = ({ count }: CountParams): string | undefined =>
  count != null && count > 0 ? String(count) : undefined;

export const prSectionOptions = ({
  pr,
  detail,
}: Params): ReadonlyArray<SegmentedTabOption<PrSection>> => {
  const tabStatus = computeTabStatus(pr, detail);
  return [
    { value: 'overview', label: 'Overview', icon: FileText },
    {
      value: 'comments',
      label: 'Conversation',
      icon: MessageSquare,
      badge: countBadge({ count: tabStatus.comments?.count }),
    },
    {
      value: 'ci',
      label: 'Checks',
      icon: ListChecks,
      badge: countBadge({ count: tabStatus.ci?.count }),
    },
  ];
};
