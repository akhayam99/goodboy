import { AlertCircle, CheckCheck, CircleDashed, MessageSquare, MinusCircle } from 'lucide-react';
import type { PrReviewState } from '@goodboy/types';

type Props = {
  readonly state: PrReviewState;
  readonly size?: number;
};

export const ReviewStateIcon = ({ state, size = 10 }: Props) => {
  if (state === 'approved') {
    return <CheckCheck size={size} aria-hidden className="shrink-0 text-success" />;
  }
  if (state === 'changes_requested') {
    return <AlertCircle size={size} aria-hidden className="shrink-0 text-danger" />;
  }
  if (state === 'commented') {
    return <MessageSquare size={size} aria-hidden className="shrink-0 text-muted-foreground" />;
  }
  if (state === 'dismissed') {
    return <MinusCircle size={size} aria-hidden className="shrink-0 text-muted-foreground" />;
  }
  return <CircleDashed size={size} aria-hidden className="shrink-0 text-muted-foreground" />;
};
