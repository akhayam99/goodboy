import { CircleAlert, CheckCheck, CircleDashed, MessageSquare, MinusCircle } from 'lucide-react';
import type { PrReviewState } from '@goodboy/types';
import { ICON_SIZE } from '@goodboy/ui';

type Props = {
  readonly state: PrReviewState;
  readonly size?: number;
};

export const ReviewStateIcon = ({ state, size = ICON_SIZE.mark }: Props) => {
  if (state === 'approved') {
    return <CheckCheck size={size} aria-hidden className="shrink-0 text-success" />;
  }
  if (state === 'changes_requested') {
    return <CircleAlert size={size} aria-hidden className="shrink-0 text-danger" />;
  }
  if (state === 'commented') {
    return <MessageSquare size={size} aria-hidden className="shrink-0 text-muted-foreground" />;
  }
  if (state === 'dismissed') {
    return <MinusCircle size={size} aria-hidden className="shrink-0 text-muted-foreground" />;
  }
  return <CircleDashed size={size} aria-hidden className="shrink-0 text-muted-foreground" />;
};
