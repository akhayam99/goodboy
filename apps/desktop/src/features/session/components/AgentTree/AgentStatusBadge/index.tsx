import type { AgentStatus } from '@goodboy/types';
import { Chip, Tooltip } from '@goodboy/ui';
import { stateDescription } from '../../../../../shared/utils/statePresentation';
import { describeAgentStatus } from '../../../agent-status';

type Props = {
  readonly status: AgentStatus;
};

export const AgentStatusBadge = ({ status }: Props) => {
  const presentation = describeAgentStatus({ status });
  return (
    <Tooltip content={stateDescription({ presentation })}>
      <span className="inline-flex shrink-0 items-center">
        <Chip
          tone={presentation.tone}
          size="3xs"
          bordered={false}
          label={presentation.label}
          className={status === 'skipped' ? 'shrink-0 opacity-70' : 'shrink-0'}
        />
      </span>
    </Tooltip>
  );
};
