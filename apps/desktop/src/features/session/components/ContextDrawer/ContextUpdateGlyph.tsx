import { AlertTriangle, Check, Clock, RefreshCw } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import type { ContextUpdatePhase } from './contextUpdateCopy';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly phase: ContextUpdatePhase;
  readonly placement: 'status' | 'button';
};

export const ContextUpdateGlyph = ({ phase, placement }: Props) => {
  if (phase === 'running') {
    return <StatusDot tone="info" size="sm" pulsing ariaLabel="Updating" />;
  }
  if (phase === 'queued') {
    return <Clock size={ICON_SIZE.mark} aria-hidden className="shrink-0" />;
  }
  if (phase === 'done') {
    return <Check size={ICON_SIZE.mark} aria-hidden className="shrink-0" />;
  }
  if (phase === 'failed' && placement === 'status') {
    return <AlertTriangle size={ICON_SIZE.mark} aria-hidden className="shrink-0 text-danger" />;
  }
  if (placement === 'status') {
    return <StatusDot tone="success" size="sm" ariaLabel="Current" />;
  }
  return <RefreshCw size={ICON_SIZE.mark} aria-hidden className="shrink-0" />;
};
