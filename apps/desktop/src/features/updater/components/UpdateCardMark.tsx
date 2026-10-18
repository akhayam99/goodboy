import { AlertCircle, ArrowUpCircle, Clock } from 'lucide-react';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import type { UpdateCardState } from '../updateCardState';

type Props = {
  readonly state: UpdateCardState;
  readonly size?: number;
};

export const UpdateCardMark = ({ state, size = ICON_SIZE.control }: Props) => {
  if (state === 'failed') {
    return <AlertCircle size={size} aria-hidden />;
  }
  if (state === 'queued') {
    return <Clock size={size} aria-hidden />;
  }
  return <ArrowUpCircle size={size} aria-hidden />;
};
