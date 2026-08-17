import { SectionHeader } from '@goodboy/ui';
import type { PlanWithCount, SessionId } from '@goodboy/types';
import { pluralize } from '../../../../shared/utils/pluralize';

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly sessionId: SessionId;
};

export const AgentBriefPlans = ({ plans, sessionId }: Props) => {
  if (plans.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2">
      <SectionHeader label="Plans" />
      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            className="flex items-center justify-between gap-4 rounded-md bg-elevated px-3 py-2 text-left text-sm ring-1 ring-border-soft"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('goodboy:open-plan-studio', {
                  detail: { sessionId, planId: plan.id },
                }),
              )
            }
          >
            <span className="min-w-0 truncate text-foreground">{plan.title}</span>
            <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
              {plan.status} · {pluralize(plan.consumptionCount, 'use')}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
