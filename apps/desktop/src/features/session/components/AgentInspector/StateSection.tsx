import { ResolverStateBadge, resolverBadgeState } from '../ResolverStateBadge';
import type { ResolverStatus } from '../../resolver-linkage';
import { InspectorSection } from '../InspectorSection';

type Props = {
  readonly status: ResolverStatus;
  readonly queuePosition: number;
  readonly queueTotal: number;
  readonly blockedBy: string | null;
};

export const StateSection = ({ status, queuePosition, queueTotal, blockedBy }: Props) => (
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
  </InspectorSection>
);
