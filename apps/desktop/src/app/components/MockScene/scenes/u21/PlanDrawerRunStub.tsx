import { Button } from '@goodboy/ui';
import { openPlanDrawer } from '../../../../../features/plans/openPlanDrawer';
import { PLAN_DRAWER_PLAN_ID, PLAN_DRAWER_SESSION_ID } from './planDrawerSeed';

export const PlanDrawerRunStub = () => (
  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-6">
    <h1 className="text-title text-foreground">Settlement export fix</h1>
    <p className="text-label text-muted-foreground">
      The planner finished step 2. Its plan waits for you.
    </p>
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-subtle px-3 py-2">
      <span className="min-w-0 truncate text-row text-foreground">
        Planner · Plan the reconciliation
      </span>
      <Button
        variant="secondary"
        size="xs"
        onClick={() =>
          openPlanDrawer({ sessionId: PLAN_DRAWER_SESSION_ID, planId: PLAN_DRAWER_PLAN_ID })
        }
      >
        Review plan
      </Button>
    </div>
  </div>
);
