import type { AgentStatus } from '@goodboy/types';
import { Chip, type Tone } from '@goodboy/ui';

const TONE: Record<AgentStatus, Tone> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

type Props = {
  readonly status: AgentStatus;
};

export const AgentStatusBadge = ({ status }: Props) => (
  <Chip
    tone={TONE[status]}
    size="3xs"
    uppercase
    bordered={false}
    label={status}
    className={status === 'skipped' ? 'shrink-0 opacity-70' : 'shrink-0'}
  />
);
