import type { AgentStatus } from '@goodboy/types';
import { Chip, type Tone } from '@goodboy/ui';

const TONE: Record<AgentStatus, Tone> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  skipped: 'neutral',
  transferred: 'neutral',
};

const LABEL: Record<AgentStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
  transferred: 'Transferred',
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
    className={
      status === 'skipped' || status === 'transferred' ? 'shrink-0 opacity-70' : 'shrink-0'
    }
  />
);
