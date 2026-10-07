import type { PrCheckConclusion } from '@goodboy/types';
import {
  AlertCircle,
  Check,
  CircleSlash,
  Clock,
  HelpCircle,
  MinusCircle,
  XCircle,
} from 'lucide-react';

type Props = {
  readonly conclusion: PrCheckConclusion;
};

const ICON_PROPS = { size: 15, 'aria-hidden': true } as const;

export const CheckConclusionIcon = ({ conclusion }: Props) => {
  if (conclusion === 'success') {
    return <Check {...ICON_PROPS} className="shrink-0 text-success" />;
  }
  if (conclusion === 'failure') {
    return <XCircle {...ICON_PROPS} className="shrink-0 text-danger" />;
  }
  if (conclusion === 'pending') {
    return <Clock {...ICON_PROPS} className="shrink-0 text-warning" />;
  }
  if (conclusion === 'cancelled' || conclusion === 'timed_out') {
    return <CircleSlash {...ICON_PROPS} className="shrink-0 text-muted-foreground" />;
  }
  if (conclusion === 'skipped' || conclusion === 'neutral' || conclusion === 'stale') {
    return <MinusCircle {...ICON_PROPS} className="shrink-0 text-muted-foreground" />;
  }
  if (conclusion === 'action_required') {
    return <AlertCircle {...ICON_PROPS} className="shrink-0 text-warning" />;
  }
  return <HelpCircle {...ICON_PROPS} className="shrink-0 text-muted-foreground" />;
};
