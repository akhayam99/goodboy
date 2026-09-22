import { HandHelping } from 'lucide-react';
import type { CapabilityObligation } from '@goodboy/types';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly obligation: CapabilityObligation;
};

const obligationLabel = ({ obligation }: Props): string => {
  const request = obligation.requests[obligation.requests.length - 1];
  if (request === undefined) {
    return `${obligation.targetRole} for ${obligation.purpose}`;
  }
  return `${obligation.targetRole} for ${obligation.purpose}: ${request.question}`;
};

export const CapabilityObligationAction = ({ obligation }: Props) => {
  const label = obligationLabel({ obligation });
  const request = obligation.requests[obligation.requests.length - 1];

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-accent/10 px-2 py-1 text-2xs text-accent-foreground">
      <HandHelping size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={label}>
        Needs: {label}
      </span>
      {request === undefined ? null : (
        <span
          className="shrink-0 text-muted-foreground/70"
          title={`gap: ${request.gap}. expected: ${request.expectedOutput}`}
        >
          {request.continuation}
        </span>
      )}
    </div>
  );
};
