import { ScrollText, SquareArrowOutUpRight } from 'lucide-react';
import type { AgentId, SessionId } from '@goodboy/types';
import { agentPlace } from '../../../store/slices/navigation/place';
import type { ObjectKindDefinition, RunStepActionTarget } from '../types';

export type RunStepFacts = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly onLeave: () => void;
};

export const RUN_STEP_KIND: ObjectKindDefinition<RunStepActionTarget, RunStepFacts> = {
  noun: 'step',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'runStep.transcript',
      label: 'View transcript',
      icon: ScrollText,
      group: 'open',
      when: () => true,
      run: ({ facts, env }) =>
        env.getState().openDrawer({
          kind: 'transcript',
          sessionId: facts.sessionId,
          payload: { agentId: facts.agentId },
        }),
    },
    {
      id: 'runStep.openFull',
      label: 'Open full',
      icon: SquareArrowOutUpRight,
      group: 'open',
      when: () => true,
      run: ({ facts, env }) => {
        facts.onLeave();
        env
          .getState()
          .navigate({ to: agentPlace({ sessionId: facts.sessionId, agentId: facts.agentId }) });
      },
    },
  ],
};
