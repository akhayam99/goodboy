import type { PlanId, PlanWithCount } from '@goodboy/types';
import { PlanRailCard } from './PlanRailCard';
import { FinishedRegister } from '../../../../shared/components/FinishedRegister';

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly openQuestionCount: number;
  readonly visibleFinishedCount?: number;
  readonly onSelect: (planId: PlanId) => void;
};

const VISIBLE_FINISHED = 30;

export const PlanList = ({
  plans,
  openQuestionCount,
  visibleFinishedCount = VISIBLE_FINISHED,
  onSelect,
}: Props) => {
  const active = plans.filter((plan) => plan.status === 'active');
  const finished = plans.filter((plan) => plan.status !== 'active');
  const visibleFinished = finished.slice(0, visibleFinishedCount);
  const earlierFinished = finished.slice(visibleFinishedCount);

  return (
    <>
      {active.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {active.map((plan) => (
            <li key={plan.id}>
              <PlanRailCard
                plan={plan}
                openQuestionCount={openQuestionCount}
                onSelect={() => onSelect(plan.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <FinishedRegister
        label="Finished"
        count={finished.length}
        visible={
          visibleFinished.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {visibleFinished.map((plan) => (
                <li key={plan.id}>
                  <PlanRailCard
                    plan={plan}
                    openQuestionCount={openQuestionCount}
                    onSelect={() => onSelect(plan.id)}
                  />
                </li>
              ))}
            </ul>
          ) : null
        }
        earlierCount={earlierFinished.length}
        earlier={
          <ul className="flex flex-col gap-2">
            {earlierFinished.map((plan) => (
              <li key={plan.id}>
                <PlanRailCard
                  plan={plan}
                  openQuestionCount={openQuestionCount}
                  onSelect={() => onSelect(plan.id)}
                />
              </li>
            ))}
          </ul>
        }
      />
    </>
  );
};
