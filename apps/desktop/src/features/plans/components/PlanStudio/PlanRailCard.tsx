import { MetaRow } from '@goodboy/ui';
import type { PlanWithCount } from '@goodboy/types';
import { RailCard } from '@goodboy/ui';
import { PlanStatusChip } from './PlanStatusChip';
import { fmtTimestamp } from './fmtTimestamp';
import { planConsumerLabel, resolvePlanConsumer } from '../../../../shared/utils/planConsumer';

type Props = {
  readonly plan: PlanWithCount;
  readonly openQuestionCount: number;
  readonly onSelect: () => void;
};

export const PlanRailCard = ({ plan, openQuestionCount, onSelect }: Props) => {
  const lastConsumer = plan.lastConsumer;
  const consumer =
    lastConsumer != null
      ? resolvePlanConsumer({ agentId: lastConsumer.agentId, agentName: lastConsumer.name })
      : null;

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
            consumer != null ? (
              <span key="consumer" className="min-w-0 truncate">
                {planConsumerLabel({ name: consumer.name, count: plan.consumptionCount })}
              </span>
            ) : null,
          ]}
        />
      }
      onSelect={onSelect}
    />
  );
};
