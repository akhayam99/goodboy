import type { AgentStatus } from '@goodboy/types';
import { Chip } from '@goodboy/ui';
import { describeAgentStatus } from '../../../agent-status';

type Props = {
  readonly status: AgentStatus;
};

export const AgentStatusBadge = ({ status }: Props) => {
  const { label, tone } = describeAgentStatus({ status });
  return (
    <Chip
      tone={tone}
      size="3xs"
      bordered={false}
      label={label}
      className={status === 'skipped' ? 'shrink-0 opacity-70' : 'shrink-0'}
    />
  );
};
