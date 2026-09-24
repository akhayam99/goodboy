import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CountToggle } from '@goodboy/ui';
import type { PlanId, PlanWithCount } from '@goodboy/types';
import { PlanRailCard } from './PlanRailCard';

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly openQuestionCount: number;
  readonly onSelect: (planId: PlanId) => void;
};

export const PlanList = ({ plans, openQuestionCount, onSelect }: Props) => {
  const [isFinishedShown, setIsFinishedShown] = useState(false);
  const active = plans.filter((plan) => plan.status === 'active');
  const finished = plans.filter((plan) => plan.status !== 'active');
  const shown = isFinishedShown ? [...active, ...finished] : active;

  return (
    <div className="flex flex-col gap-2">
      {shown.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {shown.map((plan) => (
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
      {finished.length > 0 ? (
        <div className="flex min-w-0 items-center">
          <CountToggle
            label="finished"
            count={finished.length}
            isShown={isFinishedShown}
            icon={ChevronDown}
            onChange={setIsFinishedShown}
          />
        </div>
      ) : null}
    </div>
  );
};
