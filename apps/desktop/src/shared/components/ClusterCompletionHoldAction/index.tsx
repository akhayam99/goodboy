import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { ClusterCompletionHold } from '@goodboy/types';
import { ICON_SIZE } from '../conceptIcons';
import { useAppStore } from '../../../store';

type Props = {
  readonly hold: ClusterCompletionHold;
};

const reasonLabel = ({ hold }: { readonly hold: ClusterCompletionHold }): string => {
  if (hold.reason === 'unresolved-outcome') {
    return hold.findings[0]?.reason ?? 'unresolved finding';
  }
  if (hold.reason === 'missing-outcome') {
    return 'completion outcome missing';
  }
  if (hold.reason === 'malformed-outcome') {
    return 'completion outcome malformed';
  }
  return 'completion outcome belongs to another agent';
};

export const ClusterCompletionHoldAction = ({ hold }: Props) => {
  const [isResolving, setIsResolving] = useState(false);
  const resolveHold = useAppStore((state) => state.resolveClusterCompletionHold);

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-warning/10 px-2 py-1 text-2xs text-warning">
      <AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={reasonLabel({ hold })}>
        Held: {reasonLabel({ hold })}
      </span>
      <Button
        variant="warning"
        emphasis="outline"
        size="sm"
        className="h-auto shrink-0 px-2 py-0.5 text-2xs"
        disabled={isResolving}
        data-testid={`resolve-cluster-hold-${hold.id}`}
        onClick={(event) => {
          event.stopPropagation();
          setIsResolving(true);
          void resolveHold({
            sessionId: hold.sessionId,
            holdId: hold.id,
            resolutionEvidence: 'inspected and resolved explicitly by the user',
          }).finally(() => setIsResolving(false));
        }}
      >
        {isResolving ? 'Resolving' : 'Resolve hold'}
      </Button>
    </div>
  );
};
