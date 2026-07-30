import type { ReactNode } from 'react';
import { Circle, CircleCheck, MinusCircle, XCircle } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import type { AgentStatus } from '@goodboy/types';

type Props = {
  readonly status: AgentStatus;
};

export const AgentStatusIcon = ({ status }: Props) => {
  let icon: ReactNode;

  switch (status) {
    case 'pending':
      icon = <Circle size={10} className="text-muted-foreground/60" aria-hidden />;
      break;
    case 'running':
      icon = <StatusDot tone="info" size="sm" pulsing />;
      break;
    case 'completed':
      icon = <CircleCheck size={10} className="text-success" aria-hidden />;
      break;
    case 'failed':
      icon = <XCircle size={10} className="text-danger" aria-hidden />;
      break;
    case 'skipped':
      icon = <MinusCircle size={10} className="text-muted-foreground/60" aria-hidden />;
      break;
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }

  return (
    <span
      className="inline-flex size-3 shrink-0 items-center justify-center"
      title={status}
      aria-label={status}
    >
      {icon}
    </span>
  );
};
