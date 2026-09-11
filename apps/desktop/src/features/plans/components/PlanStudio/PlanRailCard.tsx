import { MetaRow } from '@goodboy/ui';
import type { PlanWithCount } from '@goodboy/types';
import { RailCard } from '@goodboy/ui';
import { PlanStatusChip } from './PlanStatusChip';
import { fmtTimestamp } from './fmtTimestamp';

type Props = {
  readonly plan: PlanWithCount;
  readonly openQuestionCount: number;
  readonly onSelect: () => void;
};

export const PlanRailCard = ({ plan, openQuestionCount, onSelect }: Props) => {
  return (
    <RailCard
      title={plan.title}
      muted={plan.status === 'discarded'}
      status={<PlanStatusChip status={plan.status} openQuestionCount={openQuestionCount} />}
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
