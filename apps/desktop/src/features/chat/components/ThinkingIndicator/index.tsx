import { WorkNode } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import type { ThinkingContext } from '../../utils/thinking-context';
import { useElapsedMs } from '../../hooks/useElapsedMs';
import { useThinkingPhrase } from '../../hooks/useThinkingPhrase';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';

type Props = {
  readonly context: ThinkingContext;
  readonly startedAt?: IsoDateTime | null;
};

export const ThinkingIndicator = ({ context, startedAt = null }: Props) => {
  const elapsedMs = useElapsedMs({ running: true, startedAt });
  const phrase = useThinkingPhrase({ context });
  const duration = elapsedMs != null ? formatDuration({ durationMs: elapsedMs }) : null;

  return (
    <div
      role="status"
      aria-label="Agent working"
      className="relative flex w-fit items-center gap-1 rounded-md px-2 py-1 text-meta"
    >
      <WorkNode size="sm" state="running" mark={{ kind: 'dot' }} label="Thinking" />
      <span aria-hidden className="text-shimmer">
        {phrase}
      </span>
      {duration != null && (
        <span aria-hidden className="tabular-nums text-faint-foreground">
          · {duration}
        </span>
      )}
    </div>
  );
};
