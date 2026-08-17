import { Check, X } from 'lucide-react';
import { StatusDot, cn, tintClasses } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';

export type TimelineNodeStatus = Agent['status'] | 'waiting';

type Props = {
  readonly status: TimelineNodeStatus;
};

export const TimelineNode = ({ status }: Props) => {
  if (status === 'running') {
    return <StatusDot tone="info" size="sm" pulsing ariaLabel="Running" />;
  }
  if (status === 'completed') {
    return <Check size={10} aria-label="Completed" className="text-success" />;
  }
  if (status === 'skipped') {
    const tint = tintClasses('neutral');
    return <Check size={10} aria-label="Skipped" className={tint.icon} />;
  }
  if (status === 'failed') {
    return <X size={10} aria-label="Failed" className="text-danger" />;
  }
  if (status === 'waiting') {
    return (
      <span className={cn('size-2 rounded-full', tintClasses('warning').bg)} aria-label="Waiting" />
    );
  }
  const tint = tintClasses('warning');
  return (
    <span
      className={cn('size-2 rounded-full ring-1 ring-warning/50', tint.bg)}
      aria-label="Pending"
    />
  );
};
