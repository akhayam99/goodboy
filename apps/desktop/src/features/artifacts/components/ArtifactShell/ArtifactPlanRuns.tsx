import { useEffect } from 'react';
import { SectionHeader, cn } from '@goodboy/ui';
import type { Agent, AgentId, PlanId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';
import { resolvePlanConsumer } from '../../../../shared/utils/planConsumer';

type Props = {
  readonly sessionId: SessionId;
  readonly planId: PlanId;
  readonly agents: ReadonlyArray<Agent>;
};

const NO_RUNS: ReadonlyArray<never> = [];

export const ArtifactPlanRuns = ({ sessionId, planId, agents }: Props) => {
  const consumptions = useAppStore((s) => s.planConsumptions[planId] ?? NO_RUNS);
  const loadConsumptionsForPlan = useAppStore((s) => s.loadConsumptionsForPlan);
  const selectAgent = useAppStore((s) => s.selectAgent);

  useEffect(() => {
    void loadConsumptionsForPlan(planId);
  }, [planId, loadConsumptionsForPlan]);

  const open = (agentId: AgentId) => void selectAgent(sessionId, agentId);

  return (
    <section aria-label="Runs" className="flex min-w-0 flex-col gap-1.5">
      <SectionHeader label="Runs" />
      {consumptions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nobody ran this plan yet.</p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-1">
          {consumptions.map((consumption) => {
            const consumer = resolvePlanConsumer({
              agentId: consumption.agentId,
              agentName: consumption.agentName,
              agents,
            });
            return (
              <li
                key={consumption.id}
                className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span className="shrink-0">Run by</span>
                <button
                  type="button"
                  disabled={consumer.isDeleted}
                  onClick={() => open(consumption.agentId)}
                  className={cn(
                    'min-w-0 truncate text-foreground underline-offset-2 hover:underline',
                    consumer.isDeleted && 'line-through text-muted-foreground hover:no-underline',
                  )}
                >
                  {consumer.name}
                </button>
                <span aria-hidden className="text-faint-foreground">
                  ·
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatCompactDateTime({ iso: consumption.consumedAt })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
