import type { AgentId, IsoDateTime } from '@goodboy/types';
import type { StopPhase } from '../../../../shared/hooks/useAgentStop';
import { THINKING_PHRASE, WRITING_PHRASE } from '../../utils/livePhraseOf';
import { TailLine } from '../../../live-state/TailLine';
import { TAIL_ACTION } from '../../../live-state/tailAction';
import type { TailFacts } from '../../../live-state/tailFacts';

type Props = {
  readonly phrase: string;
  readonly onStop: () => void;
  readonly startedAt?: IsoDateTime | null;
  readonly waitingFor?: string | null;
  readonly stopLabel?: string;
  readonly stepAgentId?: AgentId | null;
  readonly stopPhase?: StopPhase;
};

type FactsParams = Pick<Props, 'phrase' | 'waitingFor' | 'stopLabel' | 'stopPhase'> & {
  readonly startedAt: IsoDateTime | null;
  readonly stepAgentId: AgentId | null;
};

const factsOf = ({
  phrase,
  waitingFor,
  stopLabel,
  stopPhase,
  startedAt,
  stepAgentId,
}: FactsParams): TailFacts => {
  if (stopPhase === 'stopping') {
    return {
      state: 'stopping',
      phrase: 'Stopping',
      startedAt,
      stepAgentId,
      actions: [{ ...TAIL_ACTION.stop, label: stopLabel ?? TAIL_ACTION.stop.label, isBusy: true }],
    };
  }
  if (stopPhase === 'stalled') {
    return {
      state: 'stopping',
      phrase: 'Still stopping',
      startedAt,
      stepAgentId,
      actions: [TAIL_ACTION.forceStop],
    };
  }
  const isWaiting =
    waitingFor !== null && (phrase === THINKING_PHRASE || phrase === WRITING_PHRASE);
  return {
    state: isWaiting ? 'waiting' : 'working',
    phrase: isWaiting ? `Waiting for ${waitingFor}` : phrase,
    startedAt,
    stepAgentId,
    actions: [],
  };
};

export const ConversationTail = ({
  phrase,
  onStop,
  startedAt = null,
  waitingFor = null,
  stopLabel,
  stepAgentId = null,
  stopPhase = 'idle',
}: Props) => (
  <div data-conversation-tail="" role="status" aria-label="Agent working">
    <TailLine
      facts={factsOf({ phrase, waitingFor, stopLabel, stopPhase, startedAt, stepAgentId })}
      onAction={onStop}
    />
  </div>
);
