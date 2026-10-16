import type { IsoDateTime } from '@goodboy/types';
import type { ThinkingContext } from '../../utils/thinking-context';
import { useThinkingPhrase } from '../../hooks/useThinkingPhrase';
import { TailLine } from '../../../live-state/TailLine';
import { TAIL_ACTION } from '../../../live-state/tailAction';

type Props = {
  readonly context: ThinkingContext;
  readonly onStop: () => void;
  readonly startedAt?: IsoDateTime | null;
  readonly waitingFor?: string | null;
};

export const ConversationTail = ({
  context,
  onStop,
  startedAt = null,
  waitingFor = null,
}: Props) => {
  const thinking = useThinkingPhrase({ context });
  const isWaiting = waitingFor !== null && context === 'think';
  return (
    <div data-conversation-tail="" role="status" aria-label="Agent working">
      <TailLine
        facts={{
          state: isWaiting ? 'waiting' : 'working',
          phrase: isWaiting ? `Waiting for ${waitingFor}` : thinking,
          startedAt,
          actions: [TAIL_ACTION.stop],
        }}
        onAction={onStop}
      />
    </div>
  );
};
