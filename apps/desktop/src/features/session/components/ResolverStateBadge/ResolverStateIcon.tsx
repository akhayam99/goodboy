import type { ReactNode } from 'react';
import { StatusDot } from '@goodboy/ui';
import { AlertTriangle, Ban, Check, CheckCheck, CircleStop, Clock, GitCommit } from 'lucide-react';
import type { ResolverBadgeState } from '.';

type Props = {
  readonly state: ResolverBadgeState;
};

const TITLE: Record<ResolverBadgeState, string> = {
  none: 'done',
  running: 'running',
  queued: 'queued',
  committed: 'committed',
  analyzed: 'analyzed',
  resolved: 'resolved',
  wontfix: 'wontfix',
  awaiting: 'awaiting',
  stopped: 'stopped',
  failed: 'failed',
};

export const ResolverStateIcon = ({ state }: Props) => {
  let icon: ReactNode;

  switch (state) {
    case 'running':
      icon = <StatusDot tone="info" size="sm" pulsing />;
      break;
    case 'failed':
      icon = <span className="size-1.5 rounded-full bg-danger" aria-hidden />;
      break;
    case 'stopped':
      icon = <CircleStop size={10} className="text-danger" aria-hidden />;
      break;
    case 'queued':
      icon = <Clock size={10} className="text-muted-foreground/60" aria-hidden />;
      break;
    case 'resolved':
      icon = <CheckCheck size={10} className="text-success" aria-hidden />;
      break;
    case 'committed':
      icon = <GitCommit size={10} className="text-warning" aria-hidden />;
      break;
    case 'wontfix':
      icon = <Ban size={10} className="text-muted-foreground/70" aria-hidden />;
      break;
    case 'awaiting':
    case 'analyzed':
      icon = <AlertTriangle size={10} className="text-warning" aria-hidden />;
      break;
    case 'none':
      icon = <Check size={10} className="text-muted-foreground/70" aria-hidden />;
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
