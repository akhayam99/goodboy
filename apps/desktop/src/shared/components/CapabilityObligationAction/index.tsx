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

const stateLabel = ({ obligation }: Props): string => {
  if (obligation.decision === 'refused') {
    return 'refused';
  }
  if (obligation.decision === 'refinement') {
    return 'needs narrowing';
  }
  if (obligation.decision === 'attached') {
    return 'attached to the owner';
  }
  if (obligation.state === 'satisfied') {
    return obligation.purpose === 'replan' ? 'revision adopted' : 'closed';
  }
  if (obligation.state === 'granted') {
    return 'granted';
  }
  const request = obligation.requests[obligation.requests.length - 1];
  return request === undefined ? 'pending' : request.continuation;
};

export const CapabilityObligationAction = ({ obligation }: Props) => {
  const label = obligationLabel({ obligation });
  const request = obligation.requests[obligation.requests.length - 1];
  const detail =
    obligation.decisionReason ??
    (request === undefined ? null : `gap: ${request.gap}. expected: ${request.expectedOutput}`);

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-accent/10 px-2 py-1 text-2xs text-accent-foreground">
      <HandHelping size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={label}>
        Needs: {label}
      </span>
      <span
        className="shrink-0 text-faint-foreground"
        {...(detail === null ? {} : { title: detail })}
      >
        {stateLabel({ obligation })}
      </span>
    </div>
  );
};
