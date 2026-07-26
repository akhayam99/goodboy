import type { Agent } from '@goodboy/types';
import type { AgentKind } from '../../agent-kind';
import { AgentKindChip } from '../AgentKindChip';
import { AgentDuration } from '../AgentMetricsBlock/AgentDuration';
import { AgentStatusBadge } from '../../../workspace/components/WorkspacesSidebar/parts/AgentStatusBadge';
import { InspectorSection } from './InspectorSection';

type Props = {
  readonly agent: Agent;
  readonly kind: AgentKind;
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
};

export const IdentitySection = ({ agent, kind, provider, model, effort }: Props) => (
  <InspectorSection question="What it is">
    <div className="flex flex-wrap items-center gap-1.5">
      <AgentKindChip kind={kind} />
      <AgentStatusBadge status={agent.status} />
    </div>
    <dl className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-2xs">
      <dt className="text-muted-foreground/60">Provider</dt>
      <dd className="truncate text-foreground/80">{provider ?? 'not resolved'}</dd>
      <dt className="text-muted-foreground/60">Model</dt>
      <dd className="truncate text-foreground/80">{model ?? 'not resolved'}</dd>
      <dt className="text-muted-foreground/60">Effort</dt>
      <dd className="truncate text-foreground/80">{effort ?? 'automatic'}</dd>
      <dt className="text-muted-foreground/60">Started</dt>
      <dd className="truncate font-mono text-foreground/80">{agent.startedAt ?? 'not started'}</dd>
      <dt className="text-muted-foreground/60">Duration</dt>
      <dd className="text-foreground/80">
        <AgentDuration run={agent} />
      </dd>
    </dl>
  </InspectorSection>
);
