import { useMemo } from 'react';
import type { PrDetail, PullRequestState } from '@goodboy/types';
import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { FileText, ListChecks, MessageSquare, Sparkles } from 'lucide-react';
import { computeTabStatus } from '../Card';
import type { PrSection } from './prSection';

type Props = {
  readonly pr: PullRequestState;
  readonly detail: PrDetail | null;
  readonly section: PrSection;
  readonly onSection: (section: PrSection) => void;
};

const countBadge = (count: number | undefined): string | undefined =>
  count != null && count > 0 ? String(count) : undefined;

export const PrSectionTabs = ({ pr, detail, section, onSection }: Props) => {
  const tabStatus = useMemo(() => computeTabStatus(pr, detail), [pr, detail]);
  const openResolveCount = useMemo(
    () =>
      (detail?.comments ?? []).filter(
        (comment) => comment.source === 'review' && comment.resolved === false,
      ).length,
    [detail?.comments],
  );

  const options: ReadonlyArray<SegmentedTabOption<PrSection>> = [
    { value: 'overview', label: 'Overview', icon: FileText },
    {
      value: 'comments',
      label: 'Conversation',
      icon: MessageSquare,
      badge: countBadge(tabStatus.comments?.count),
    },
    {
      value: 'resolve',
      label: 'Resolve',
      icon: Sparkles,
      badge: countBadge(openResolveCount),
    },
    { value: 'ci', label: 'Checks', icon: ListChecks, badge: countBadge(tabStatus.ci?.count) },
  ];

  return (
    <SegmentedTabs
      ariaLabel="Pull request sections"
      options={options}
      value={section}
      onChange={onSection}
      size="sm"
    />
  );
};
