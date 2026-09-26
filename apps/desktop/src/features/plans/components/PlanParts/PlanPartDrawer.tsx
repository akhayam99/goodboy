import { DrawerFrame, Markdown, SectionHeader } from '@goodboy/ui';
import type { Agent, ArtifactId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPlans, agentPlace } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { partRoutingLabel } from './partRoutingLabel';
import { usePlanPartRows } from './usePlanPartRows';

type Props = {
  readonly sessionId: SessionId;
  readonly planId: ArtifactId;
  readonly index: number;
  readonly onClose: () => void;
};

export const PlanPartDrawer = ({ sessionId, planId, index, onClose }: Props) => {
  const plans = useSessionPlans(sessionId);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const navigate = useAppStore((s) => s.navigate);
  const plan = plans.find((candidate) => candidate.id === planId) ?? null;
  const rows = usePlanPartRows({ sessionId, plan, agents });
  const row = rows[index] ?? null;

  if (plan === null || row === null) {
    return null;
  }

  const carrier = agents.find((agent) => agent.id === row.agentId) ?? null;
  const proposal = plan.clusters?.[index]?.routingProposal ?? null;

  return (
    <DrawerFrame
      title={`Part ${index + 1} of ${rows.length}`}
      icon={CONCEPT_ICONS.plan}
      iconClassName="text-muted-foreground"
      closeLabel="Close the part"
      onClose={onClose}
    >
      <div data-testid="plan-part-drawer" className="flex min-w-0 flex-col gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-base font-semibold leading-6 text-foreground">{row.title}</h3>
          {carrier === null ? (
            <p className="text-label text-muted-foreground">{row.node.label}</p>
          ) : (
            <p className="flex min-w-0 items-center gap-1.5 text-label text-muted-foreground">
              <span className="min-w-0 truncate">{`${row.node.label} as ${carrier.name}`}</span>
              <button
                type="button"
                onClick={() => navigate({ to: agentPlace({ sessionId, agentId: carrier.id }) })}
                className="shrink-0 text-foreground underline-offset-2 hover:underline"
              >
                Open
              </button>
            </p>
          )}
        </div>
        <section aria-label="Instructions" className="flex min-w-0 flex-col gap-1.5">
          <SectionHeader label="Instructions" />
          <Markdown text={row.instructions} className="text-body" />
        </section>
        {row.doneWhen.length === 0 ? null : (
          <section aria-label="Done when" className="flex min-w-0 flex-col gap-1.5">
            <SectionHeader label="Done when" />
            <ul className="flex min-w-0 list-disc flex-col gap-1 pl-5 text-body text-foreground">
              {row.doneWhen.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </section>
        )}
        {row.touches.length === 0 ? null : (
          <section aria-label="Touches" className="flex min-w-0 flex-col gap-1.5">
            <SectionHeader label="Touches" />
            <ul className="flex min-w-0 flex-col gap-0.5 text-code text-muted-foreground">
              {row.touches.map((path) => (
                <li key={path} className="truncate" title={path}>
                  {path}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section aria-label="Routing" className="flex min-w-0 flex-col gap-1.5">
          <SectionHeader label="Routing" />
          <p className="text-body text-foreground">{partRoutingLabel({ row })}</p>
          {proposal === null ? (
            <p className="text-label text-muted-foreground">
              The planner proposed no model, so the part runs on Auto.
            </p>
          ) : (
            <p className="text-label text-muted-foreground">{proposal.reason}</p>
          )}
        </section>
      </div>
    </DrawerFrame>
  );
};
