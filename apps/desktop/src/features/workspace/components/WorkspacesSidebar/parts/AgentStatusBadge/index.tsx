import type { AgentStatus } from '@goodboy/types';

const CLASS_NAME: Record<AgentStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-info/10 text-info',
  completed: 'bg-success/10 text-success',
  failed: 'bg-danger/10 text-danger',
  skipped: 'bg-muted text-muted-foreground/70',
};

type Props = {
  readonly status: AgentStatus;
};

export const AgentStatusBadge = ({ status }: Props) => (
  <span
    className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-3xs font-medium uppercase tracking-wide ${CLASS_NAME[status]}`}
  >
    {status}
  </span>
);
