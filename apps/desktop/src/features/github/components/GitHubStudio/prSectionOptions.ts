import type { PrDetail, PullRequestState } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import { FileText, ListChecks, MessageSquare, Sparkles } from 'lucide-react';
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
  const openResolveCount = (detail?.comments ?? []).filter(
    (comment) => comment.source === 'review' && comment.resolved === false,
  ).length;

  return [
    { value: 'overview', label: 'Overview', icon: FileText },
    {
      value: 'comments',
      label: 'Conversation',
      icon: MessageSquare,
      badge: countBadge({ count: tabStatus.comments?.count }),
    },
    {
      value: 'resolve',
      label: 'Resolve',
      icon: Sparkles,
      badge: countBadge({ count: openResolveCount }),
    },
    {
      value: 'ci',
      label: 'Checks',
      icon: ListChecks,
      badge: countBadge({ count: tabStatus.ci?.count }),
    },
  ];
};
