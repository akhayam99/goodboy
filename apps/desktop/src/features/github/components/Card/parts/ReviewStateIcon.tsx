import { AlertCircle, CheckCheck, CircleDashed, MessageSquare, MinusCircle } from 'lucide-react';
import type { PrReviewState } from '@goodboy/types';

type Props = {
  readonly state: PrReviewState;
};

export const ReviewStateIcon = ({ state }: Props) => {
  const props = { size: 10, 'aria-hidden': true } as const;
  if (state === 'approved') {
    return <CheckCheck {...props} className="text-success" />;
  }
  if (state === 'changes_requested') {
    return <AlertCircle {...props} className="text-danger" />;
  }
  if (state === 'commented') {
    return <MessageSquare {...props} className="text-muted-foreground" />;
  }
  if (state === 'dismissed') {
    return <MinusCircle {...props} className="text-muted-foreground" />;
  }
  return <CircleDashed {...props} className="text-muted-foreground" />;
};
