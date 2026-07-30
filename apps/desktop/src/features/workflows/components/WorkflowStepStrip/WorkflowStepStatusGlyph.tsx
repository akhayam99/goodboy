import { AlertTriangle, Check, Clock, LoaderCircle } from 'lucide-react';
import type { AgentStatus } from '@goodboy/types';

type Props = {
  readonly status: AgentStatus;
};

export const WorkflowStepStatusGlyph = ({ status }: Props) => {
  if (status === 'running') {
    return <LoaderCircle size={12} aria-label="running" className="animate-spin text-info" />;
  }
  if (status === 'completed') {
    return <Check size={12} aria-label="completed" className="text-success" />;
  }
  if (status === 'skipped') {
    return <Check size={12} aria-label="skipped" className="text-muted-foreground/60" />;
  }
  if (status === 'failed') {
    return <AlertTriangle size={12} aria-label="failed" className="text-danger" />;
  }
  return <Clock size={12} aria-label="pending" className="text-muted-foreground/50" />;
};
