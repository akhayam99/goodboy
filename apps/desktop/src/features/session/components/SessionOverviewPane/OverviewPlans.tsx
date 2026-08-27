import { useMemo } from 'react';
import { Chip, Eyebrow } from '@goodboy/ui';
import type { Agent, Plan, Session } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { splitWorkflowRuns } from '../../../workflows/activeWorkflowRuns';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';

type Props = {
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const OverviewPlans = ({ session, agents, onSelectLens }: Props) => {
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const { active } = useMemo(
    () => splitWorkflowRuns({ attachedRuns, agents }),
    [agents, attachedRuns],
  );
  const plans = useAppStore(
    (s) => s.sessionPlans[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<Plan>),
  );
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const activeRunIds = new Set(active.map(({ run }) => run.id));

  const actionable = plans.filter(
    (plan) =>
      plan.status === 'active' &&
      (plan.workflowRunId == null || activeRunIds.has(plan.workflowRunId)),
  );
  if (actionable.length === 0) {
    return null;
  }

  return (
    <section aria-label="Plan" className="flex flex-col gap-2">
      <Eyebrow label="Plan" className="px-0.5" />
      <ul className="flex flex-col gap-1">
        {actionable.map((plan) => (
          <li key={plan.id}>
            <button
              type="button"
              onClick={() => {
                setFocusedPlanId(session.id, plan.id);
                onSelectLens('plans');
              }}
              className="flex w-full items-center gap-2 rounded-lg border-l-2 border-border-soft px-3 py-1.5 text-left hover:bg-muted/40"
            >
              <CONCEPT_ICONS.plans
                size={13}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{plan.title}</span>
              {plan.clusters != null && plan.clusters.length > 0 ? (
                <Chip
                  tone="neutral"
                  size="3xs"
                  bordered={false}
                  label={`${plan.clusters.length} ${plan.clusters.length === 1 ? 'cluster' : 'clusters'}`}
                />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
