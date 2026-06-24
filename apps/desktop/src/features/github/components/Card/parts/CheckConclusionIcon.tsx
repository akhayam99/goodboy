import {
  AlertCircle,
  Check,
  CircleSlash,
  Clock,
  HelpCircle,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import type { PrCheckConclusion } from '@goodboy/types';

type Props = {
  readonly conclusion: PrCheckConclusion;
};

export const CheckConclusionIcon = ({ conclusion }: Props) => {
  const props = { size: 11, 'aria-hidden': true } as const;
  if (conclusion === 'success') {
    return <Check {...props} className="text-success" />;
  }
  if (conclusion === 'failure') {
    return <XCircle {...props} className="text-danger" />;
  }
  if (conclusion === 'pending') {
    return <Clock {...props} className="text-warning" />;
  }
  if (conclusion === 'cancelled' || conclusion === 'timed_out') {
    return <CircleSlash {...props} className="text-muted-foreground" />;
  }
  if (conclusion === 'skipped' || conclusion === 'neutral' || conclusion === 'stale') {
    return <MinusCircle {...props} className="text-muted-foreground" />;
  }
  if (conclusion === 'action_required') {
    return <AlertCircle {...props} className="text-warning" />;
  }
  return <HelpCircle {...props} className="text-muted-foreground" />;
};
