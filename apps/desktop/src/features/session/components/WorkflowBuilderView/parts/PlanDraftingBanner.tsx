import { StatusDot } from '@goodboy/ui';

export const PlanDraftingBanner = () => (
  <div
    role="status"
    aria-label="Drafting plan"
    className="flex items-center gap-2 rounded-md bg-subtle/70 px-2.5 py-1.5 ring-1 ring-border-soft"
  >
    <StatusDot tone="info" size="sm" pulsing />
    <span className="text-2xs text-muted-foreground">
      Drafting a new plan. These steps stay until it lands.
    </span>
  </div>
);
