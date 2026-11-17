import type { DockPlan } from './dockPlanOf';

type Params = {
  readonly plan: DockPlan;
};

export const planBlockedReasonOf = ({ plan }: Params): string | null => {
  const next = plan.version + 1;
  if (plan.kind === 'updating') {
    return plan.by === 'lead'
      ? `The Lead is reading your changes to plan v${plan.version}`
      : `The Planner is writing plan v${next}`;
  }
  if (plan.kind === 'failed') {
    return `Plan v${next} failed. Keep plan v${plan.version} to approve it.`;
  }
  return null;
};
