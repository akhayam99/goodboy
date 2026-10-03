import type { ReactNode } from 'react';
import type { GroupSummary } from '../../../../timeline/groupSummary';
import { TimelineFoldSummary } from './TimelineFoldSummary';

type Props = {
  readonly summary: GroupSummary;
  readonly children: ReactNode;
};

export const TimelineFoldTitle = ({ summary, children }: Props) => (
  <span className="@container flex min-w-0 flex-1 items-baseline gap-2">
    {children}
    <TimelineFoldSummary summary={summary} />
  </span>
);
