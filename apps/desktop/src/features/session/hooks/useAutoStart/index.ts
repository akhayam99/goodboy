import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AgentKindRouting } from '../../agent-kind';
import { openAgentRevealEvent } from '../../../../shared/utils/openAgentReveal';

type Params = {
  readonly sessionId: SessionId;
};

type StartParams = {
  readonly goal: string;
  readonly routing: AgentKindRouting;
};

export const useAutoStart = ({ sessionId }: Params) => {
  const spawnAgent = useAppStore((state) => state.spawnAgent);
  return async ({ goal, routing }: StartParams): Promise<void> => {
    await spawnAgent(sessionId, {
      kindOverride: 'auto',
      provider: routing.provider,
      model: routing.model,
      effort: routing.effort,
      initialPrompt: goal.trim(),
      focus: 'agent',
    });
    window.dispatchEvent(openAgentRevealEvent());
  };
};
