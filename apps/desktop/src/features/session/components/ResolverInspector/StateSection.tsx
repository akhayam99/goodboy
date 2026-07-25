import type { Agent, SessionId } from '@goodboy/types';
import { ResolverStateBadge, resolverBadgeState } from '../ResolverStateBadge';
import { ForceCloseResolverAction } from '../ForceCloseResolverAction';
import { ForceResolveAction } from '../ForceResolveAction';
import type { ResolverStatus } from '../../resolver-linkage';
import { InspectorSection } from './InspectorSection';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
  readonly queuePosition: number;
  readonly queueTotal: number;
  readonly blockedBy: string | null;
};

export const StateSection = ({
  agent,
  sessionId,
  status,
  queuePosition,
  queueTotal,
  blockedBy,
}: Props) => (
  <InspectorSection question="What state it is in">
    <div className="flex items-center gap-2">
      <ResolverStateBadge state={resolverBadgeState(status)} />
      <span className="text-2xs tabular-nums text-muted-foreground/70">
        {queuePosition} of {queueTotal} in the queue
      </span>
    </div>
    {blockedBy !== null ? (
      <p className="text-2xs text-warning">blocked: {blockedBy}</p>
    ) : (
      <p className="text-2xs text-muted-foreground/60">not blocked</p>
    )}
    <div className="flex flex-wrap items-center gap-1.5">
      <ForceCloseResolverAction agent={agent} sessionId={sessionId} status={status} />
      <ForceResolveAction agent={agent} sessionId={sessionId} status={status} />
    </div>
  </InspectorSection>
);
