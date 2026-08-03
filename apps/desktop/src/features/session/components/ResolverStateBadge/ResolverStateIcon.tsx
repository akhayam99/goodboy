import type { ReactNode } from 'react';
import { StatusDot } from '@goodboy/ui';
import { AlertTriangle, CheckCheck, Clock } from 'lucide-react';
import type { ResolverBadgeState } from '.';

type Props = {
  readonly state: ResolverBadgeState;
};

const TITLE: Record<ResolverBadgeState, string> = {
  queued: 'queued',
  working: 'working',
  needsYou: 'needs you',
  failed: 'failed',
  resolved: 'resolved',
};

export const ResolverStateIcon = ({ state }: Props) => {
  let icon: ReactNode;

  switch (state) {
    case 'working':
      icon = <StatusDot tone="info" size="sm" pulsing />;
      break;
    case 'failed':
      icon = <span className="size-1.5 rounded-full bg-danger" aria-hidden />;
      break;
    case 'queued':
      icon = <Clock size={10} className="text-muted-foreground/60" aria-hidden />;
      break;
    case 'resolved':
      icon = <CheckCheck size={10} className="text-success" aria-hidden />;
      break;
    case 'needsYou':
      icon = <AlertTriangle size={10} className="text-warning" aria-hidden />;
      break;
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }

  return (
    <span
      className="inline-flex size-3 shrink-0 items-center justify-center"
      title={TITLE[state]}
      aria-label={TITLE[state]}
    >
      {icon}
    </span>
  );
};
