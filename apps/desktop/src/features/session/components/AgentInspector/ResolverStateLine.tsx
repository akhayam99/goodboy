import {
  ResolverStateBadge,
  resolverBadgeState,
  resolverStateSentence,
} from '../ResolverStateBadge';
import type { ResolverStatus } from '../../resolver-linkage';

type Props = {
  readonly status: ResolverStatus;
  readonly queuePosition: number;
  readonly queueTotal: number;
  readonly blockedBy: string | null;
};

export const ResolverStateLine = ({ status, queuePosition, queueTotal, blockedBy }: Props) => {
  const sentence = resolverStateSentence(status);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <ResolverStateBadge state={resolverBadgeState(status)} />
        {sentence !== null && <span className="text-2xs text-muted-foreground">{sentence}</span>}
        {status === 'pending' && (
          <span className="text-2xs tabular-nums text-muted-foreground/70">
            {queuePosition} of {queueTotal}
          </span>
        )}
      </div>
      {blockedBy !== null && <p className="text-2xs text-warning">blocked: {blockedBy}</p>}
    </div>
  );
};
