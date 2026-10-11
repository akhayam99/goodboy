import { StatusDot, tintClasses, Tooltip } from '@goodboy/ui';
import type { AgentStatus } from '@goodboy/types';
import { describeAgentStatus } from '../../agent-status';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly status: AgentStatus;
};

export const AgentStatusIcon = ({ status }: Props) => {
  const presentation = describeAgentStatus({ status });
  const description = stateDescription({ presentation });
  const Icon = presentation.icon;

  return (
    <Tooltip content={description}>
      <span
        className="inline-flex size-3 shrink-0 items-center justify-center"
        role="img"
        aria-label={description}
      >
        {status === 'running' ? (
          <StatusDot tone={presentation.tone} size="sm" pulsing />
        ) : (
          <Icon size={ICON_SIZE.mark} className={tintClasses(presentation.tone).icon} aria-hidden />
        )}
      </span>
    </Tooltip>
  );
};
