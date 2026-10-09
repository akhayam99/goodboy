import type { Agent } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatDateTime } from '../../../../shared/utils/time/formatDateTime';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';

type Props = {
  readonly run: Agent;
};

export const AgentDuration = ({ run }: Props) => {
  const isLive = run.startedAt != null && run.completedAt == null;
  const now = useNow(5_000, isLive);

  if (run.startedAt == null) {
    return (
      <span className="text-faint-foreground tabular-nums" title="Not started yet">
        0
      </span>
    );
  }

  const worked = formatSpan({ from: run.startedAt, to: run.completedAt ?? now });
  const startedAt = formatDateTime({ at: run.startedAt, hasYear: true });
  const tooltip =
    run.completedAt != null
      ? `Started ${startedAt}\nCompleted ${formatDateTime({ at: run.completedAt, hasYear: true })}\nWorked ${worked}`
      : `Started ${startedAt}\nWorking for ${worked}`;

  return (
    <span className="tabular-nums" title={tooltip}>
      {worked}
    </span>
  );
};
