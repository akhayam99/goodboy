import { SectionSurface, cn, tintClasses } from '@goodboy/ui';
import type { PlanWithCount, SessionId } from '@goodboy/types';
import { pluralize } from '../../../../shared/utils/pluralize';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';

const planTint = tintClasses(CONCEPT_TONE.plans);

type Props = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly sessionId: SessionId;
};

export const AgentBriefPlans = ({ plans, sessionId }: Props) => {
  if (plans.length === 0) {
    return null;
  }
  return (
    <SectionSurface label="Plans">
      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            className={cn(
              'flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-left text-xs leading-4 transition-colors',
              planTint.bgSoft,
              planTint.borderSoft,
              planTint.hoverBgSoft,
            )}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('goodboy:open-plan-studio', {
                  detail: { sessionId, planId: plan.id },
                }),
              )
            }
          >
            <span className="flex min-w-0 items-center gap-2">
              <CONCEPT_ICONS.plans size={ICON_SIZE.row} aria-hidden className={planTint.icon} />
              <span className="min-w-0 truncate text-foreground">{plan.title}</span>
            </span>
            <span className="shrink-0 text-3xs tabular-nums text-muted-foreground">
              {plan.status} · {pluralize(plan.consumptionCount, 'use')}
            </span>
          </button>
        ))}
      </div>
    </SectionSurface>
  );
};
