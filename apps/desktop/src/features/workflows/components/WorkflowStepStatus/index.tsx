import { Check, CircleX, Clock } from 'lucide-react';
import type { AgentStatus } from '@goodboy/types';
import { StatusDot } from '@goodboy/ui';

type Props = {
  readonly status: AgentStatus | null;
  readonly label: string;
  readonly variant?: 'glyph' | 'dot';
};

export const WorkflowStepStatus = ({ status, label, variant = 'glyph' }: Props) => {
  const resolvedStatus = status ?? 'pending';
  const ariaLabel = `${label} status: ${resolvedStatus}`;

  if (variant === 'dot') {
    const tone =
      resolvedStatus === 'completed'
        ? 'success'
        : resolvedStatus === 'running'
          ? 'primary'
          : resolvedStatus === 'failed'
            ? 'danger'
            : 'neutral';
    return (
      <StatusDot
        tone={tone}
        size="sm"
        pulsing={resolvedStatus === 'running'}
        ariaLabel={ariaLabel}
      />
    );
  }

  if (resolvedStatus === 'running') {
    return <StatusDot tone="primary" size="sm" pulsing ariaLabel={ariaLabel} />;
  }
  if (resolvedStatus === 'completed') {
    return <Check size={11} className="shrink-0 text-success" role="img" aria-label={ariaLabel} />;
  }
  if (resolvedStatus === 'failed') {
    return <CircleX size={11} className="shrink-0 text-danger" role="img" aria-label={ariaLabel} />;
  }
  if (resolvedStatus === 'skipped') {
    return (
      <Check
        size={11}
        className="shrink-0 text-muted-foreground"
        role="img"
        aria-label={ariaLabel}
      />
    );
  }
  return (
    <Clock
      size={11}
      className="shrink-0 text-muted-foreground/60"
      role="img"
      aria-label={ariaLabel}
    />
  );
};
