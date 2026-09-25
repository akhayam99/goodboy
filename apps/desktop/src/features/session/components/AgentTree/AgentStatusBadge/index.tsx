import type { AgentStatus } from '@goodboy/types';
import { Chip, type Tone } from '@goodboy/ui';

const TONE: Record<AgentStatus, Tone> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  blocked: 'warning',
  skipped: 'neutral',
  stopped: 'neutral',
};

const LABEL: Record<AgentStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  blocked: 'Blocked',
  skipped: 'Skipped',
  stopped: 'Stopped',
};

type Props = {
  readonly status: AgentStatus;
};

export const AgentStatusBadge = ({ status }: Props) => (
  <Chip
    tone={TONE[status]}
    size="3xs"
    bordered={false}
    label={LABEL[status]}
    className={status === 'skipped' ? 'shrink-0 opacity-70' : 'shrink-0'}
  />
);
