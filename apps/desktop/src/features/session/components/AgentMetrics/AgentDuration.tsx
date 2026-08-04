import type { Agent } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import {
  formatAbsoluteDateTime,
  formatRelativeDuration,
} from '../../../../shared/utils/relativeDate';

type Props = {
  readonly run: Agent;
};

export const AgentDuration = ({ run }: Props) => {
  const isLive = run.startedAt != null && run.completedAt == null;
  useNow(5_000, isLive);

  if (run.startedAt == null) {
    return (
      <span className="font-mono text-muted-foreground/50" title="Not started yet">
        0
      </span>
    );
  }

  const worked = formatRelativeDuration(run.startedAt, run.completedAt);
  const startedAt = formatAbsoluteDateTime({ iso: run.startedAt });
  const tooltip =
    run.completedAt != null
      ? `Started ${startedAt}\nCompleted ${formatAbsoluteDateTime({ iso: run.completedAt })}\nWorked ${worked}`
      : `Started ${startedAt}\nWorking for ${worked}`;

  return (
    <span className="font-mono" title={tooltip}>
      {worked}
    </span>
  );
};
