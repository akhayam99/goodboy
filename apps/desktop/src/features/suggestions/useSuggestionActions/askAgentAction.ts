import type { AgentId, SessionId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import type { AgentQueuedTurnInput } from '../../../store/slices/agentQueue/types';
import type { SuggestionActions } from '.';

type SendParams = {
  readonly sessionId: SessionId;
  readonly turn: AgentQueuedTurnInput;
};

type Delivery = {
  readonly isDelivered: boolean;
  readonly failure: string | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly agentLabel: string;
  readonly sendAgentMessage: (params: SendParams) => Promise<Delivery>;
};

const ASK_TEXT =
  'Stop and tell me what is blocking you. Say what you tried and what you need from me.';

export const askAgentAction = ({
  sessionId,
  agentId,
  agentLabel,
  sendAgentMessage,
}: Params): SuggestionActions['primary'] => ({
  label: NAMES.askAgent,
  isDisabled: false,
  failureTitle: `Couldn't ask the ${agentLabel}`,
  run: async () => {
    const delivery = await sendAgentMessage({
      sessionId,
      turn: {
        id: crypto.randomUUID(),
        agentId,
        content: ASK_TEXT,
        attachments: [],
        override: undefined,
      },
    });
    if (!delivery.isDelivered && delivery.failure !== null) {
      throw new Error(delivery.failure);
    }
  },
});
