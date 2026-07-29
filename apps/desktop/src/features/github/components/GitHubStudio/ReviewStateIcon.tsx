import type { PrReviewState } from '@goodboy/types';
import { AlertCircle, Check, CheckCheck, MinusCircle } from 'lucide-react';

type Props = {
  readonly state: PrReviewState;
};

export const ReviewStateIcon = ({ state }: Props) => {
  if (state === 'approved') {
    return <CheckCheck size={12} aria-hidden className="shrink-0 text-success" />;
  }

  if (state === 'changes_requested') {
    return <AlertCircle size={12} aria-hidden className="shrink-0 text-danger" />;
  }

  if (state === 'dismissed') {
    return <MinusCircle size={12} aria-hidden className="shrink-0 text-muted-foreground" />;
  }

  return <Check size={12} aria-hidden className="shrink-0 text-muted-foreground" />;
};
