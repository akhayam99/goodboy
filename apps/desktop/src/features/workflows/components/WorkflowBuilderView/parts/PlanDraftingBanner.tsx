import { StatusDot } from '@goodboy/ui';

export const PlanDraftingBanner = () => (
  <div
    role="status"
    aria-label="Drafting plan"
    className="flex items-center gap-2 rounded-md bg-subtle px-3 py-2 ring-1 ring-border-soft"
  >
    <StatusDot tone="info" size="sm" pulsing />
    <span className="text-meta text-muted-foreground">
      Drafting a new plan. These steps stay until it lands.
    </span>
  </div>
);
