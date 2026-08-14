import { MetaRow, cn } from '@goodboy/ui';
import type { PlanWithCount } from '@goodboy/types';
import { RailCard } from '@goodboy/ui';
import { planStatusBadge } from './planStatusBadge';
import { fmtTimestamp } from './fmtTimestamp';

type Props = {
  readonly plan: PlanWithCount;
  readonly onSelect: () => void;
};

export const PlanRailCard = ({ plan, onSelect }: Props) => {
  const badge = planStatusBadge({ status: plan.status });

  return (
    <RailCard
      title={plan.title}
      muted={plan.status === 'discarded'}
      status={
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-2xs lowercase tracking-wide',
            badge.className,
          )}
        >
          {badge.label}
        </span>
      }
      meta={
        <MetaRow
          items={[
            <span key="created" className="tabular-nums">
              {fmtTimestamp(plan.createdAt)}
            </span>,
          ]}
        />
      }
      onSelect={onSelect}
    />
  );
};
