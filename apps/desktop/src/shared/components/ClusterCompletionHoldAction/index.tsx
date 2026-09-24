import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Input, cn, tintClasses } from '@goodboy/ui';
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
  const [isCollectingEvidence, setIsCollectingEvidence] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionEvidence, setResolutionEvidence] = useState('');
  const resolveHold = useAppStore((state) => state.resolveClusterCompletionHold);
  const trimmedEvidence = resolutionEvidence.trim();

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-2xs text-warning',
        tintClasses('warning').bg,
      )}
    >
      <AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={reasonLabel({ hold })}>
        Held: {reasonLabel({ hold })}
      </span>
      {isCollectingEvidence ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-1"
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (trimmedEvidence.length === 0 || isResolving) {
              return;
            }
            setIsResolving(true);
            void resolveHold({
              sessionId: hold.sessionId,
              holdId: hold.id,
              resolutionEvidence: trimmedEvidence,
            }).finally(() => setIsResolving(false));
          }}
        >
          <Input
            autoFocus
            aria-label="Resolution evidence"
            value={resolutionEvidence}
            disabled={isResolving}
            className="h-7 min-w-32 text-2xs"
            placeholder="What did you verify?"
            onChange={(event) => setResolutionEvidence(event.target.value)}
          />
          <Button
            type="submit"
            variant="warning"
            emphasis="outline"
            size="sm"
            className="h-auto shrink-0 px-2 py-0.5 text-2xs"
            disabled={trimmedEvidence.length === 0 || isResolving}
          >
            {isResolving ? 'Resolving' : 'Resolve'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto shrink-0 px-2 py-0.5 text-2xs"
            disabled={isResolving}
            onClick={() => setIsCollectingEvidence(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="warning"
          emphasis="outline"
          size="sm"
          className="h-auto shrink-0 px-2 py-0.5 text-2xs"
          data-testid={`resolve-cluster-hold-${hold.id}`}
          onClick={(event) => {
            event.stopPropagation();
            setIsCollectingEvidence(true);
          }}
        >
          Resolve hold
        </Button>
      )}
    </div>
  );
};
