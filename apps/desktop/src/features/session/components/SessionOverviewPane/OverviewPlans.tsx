import { NotebookPen } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { Plan, Session } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const OverviewPlans = ({ session, onSelectLens }: Props) => {
  const plans = useAppStore(
    (s) => s.sessionPlans[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<Plan>),
  );
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);

  const active = plans.filter((plan) => plan.status === 'active');
  if (active.length === 0) {
    return null;
  }

  return (
    <section aria-label="Plan" className="flex flex-col gap-2">
      <Eyebrow label="Plan" />
      <ul className="flex flex-col gap-1">
        {active.map((plan) => (
          <li key={plan.id}>
            <button
              type="button"
              onClick={() => {
                setFocusedPlanId(session.id, plan.id);
                onSelectLens('plans');
              }}
              className="flex w-full items-center gap-2 rounded-lg border-l-2 border-border-soft px-3 py-1.5 text-left hover:bg-muted/40"
            >
              <NotebookPen size={13} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{plan.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
