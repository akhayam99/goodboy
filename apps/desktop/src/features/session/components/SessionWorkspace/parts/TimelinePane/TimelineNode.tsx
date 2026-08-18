import { Check, X } from 'lucide-react';
import { StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';

type Props = {
  readonly status: Agent['status'];
  readonly size?: 'main' | 'child';
};

export const TimelineNode = ({ status, size = 'main' }: Props) => {
  if (size === 'child') {
    const tone =
      status === 'running'
        ? 'info'
        : status === 'completed'
          ? 'success'
          : status === 'failed'
            ? 'danger'
            : 'neutral';
    const tint = tintClasses(tone);
    return <span className={cn('size-1.5 rounded-full', tint.bg)} aria-label={status} />;
  }
  if (status === 'running') {
    return <StatusDot tone="info" size="sm" pulsing ariaLabel="Running" />;
  }
  if (status === 'completed') {
    return <Check size={10} aria-label="Completed" className="text-success" />;
  }
  if (status === 'failed') {
    return <X size={10} aria-label="Failed" className="text-danger" />;
  }
  const tint = tintClasses('neutral');
  return <span className={cn('size-2 rounded-full', tint.bg)} aria-label={status} />;
};
