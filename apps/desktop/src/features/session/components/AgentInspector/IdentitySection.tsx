import type { Agent } from '@goodboy/types';
import { SectionHeader } from '@goodboy/ui';
import type { AgentKind } from '../../agent-kind';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { AgentKindChip } from '../AgentKindChip';
import { AgentDuration } from '../AgentMetrics/AgentDuration';
import { AgentStatusBadge } from '../../../workspace/components/WorkspacesSidebar/parts/AgentStatusBadge';
import { formatAbsoluteDateTime } from '../../../../shared/utils/relativeDate';

type Props = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
};

export const IdentitySection = ({ agent, kind, provider, model, effort }: Props) => (
  <section className="flex flex-col gap-2">
    <SectionHeader label="Identity" />
    <div className="flex flex-wrap items-center gap-1.5">
      <AgentKindChip kind={kind} />
      <AgentStatusBadge status={agent.status} />
    </div>
    <RoutingBadge variant="full" provider={provider} model={model} effort={effort} />
    <dl className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-2xs">
      <dt className="text-muted-foreground/60">Started</dt>
      <dd className="text-foreground/80">
        {agent.startedAt == null ? 'not started' : formatAbsoluteDateTime({ iso: agent.startedAt })}
      </dd>
      <dt className="text-muted-foreground/60">Duration</dt>
      <dd className="text-foreground/80">
        <AgentDuration run={agent} />
      </dd>
    </dl>
  </section>
);
