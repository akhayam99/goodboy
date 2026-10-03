import { AlertTriangle, Check, Clock, RefreshCw } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import type { ContextUpdatePhase } from './contextUpdateCopy';

type Props = {
  readonly phase: ContextUpdatePhase;
  readonly placement: 'status' | 'button';
};

export const ContextUpdateGlyph = ({ phase, placement }: Props) => {
  if (phase === 'running') {
    return <StatusDot tone="info" size="sm" pulsing ariaLabel="Updating" />;
  }
  if (phase === 'queued') {
    return <Clock size={11} aria-hidden className="shrink-0" />;
  }
  if (phase === 'done') {
    return <Check size={11} aria-hidden className="shrink-0" />;
  }
  if (phase === 'failed' && placement === 'status') {
    return <AlertTriangle size={11} aria-hidden className="shrink-0 text-danger" />;
  }
  if (placement === 'status') {
    return <StatusDot tone="success" size="sm" ariaLabel="Current" />;
  }
  return <RefreshCw size={11} aria-hidden className="shrink-0" />;
};
