import { StatusDot, tintClasses } from '@goodboy/ui';
import type { AgentStatus } from '@goodboy/types';
import { describeAgentStatus } from '../../agent-status';
import { stateDescription } from '../../../../shared/utils/statePresentation';

type Props = {
  readonly status: AgentStatus;
};

export const AgentStatusIcon = ({ status }: Props) => {
  const presentation = describeAgentStatus({ status });
  const description = stateDescription({ presentation });
  const Icon = presentation.icon;

  return (
    <span
      className="inline-flex size-3 shrink-0 items-center justify-center"
      title={description}
      aria-label={description}
    >
      {status === 'running' ? (
        <StatusDot tone={presentation.tone} size="sm" pulsing />
      ) : (
        <Icon size={10} className={tintClasses(presentation.tone).icon} aria-hidden />
      )}
    </span>
  );
};
