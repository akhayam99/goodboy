import { Copy, PanelRight } from 'lucide-react';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { agentPlace } from '../../../store/slices/navigation/place';
import type { ObjectKindDefinition, PlanPartActionTarget } from '../types';

export type PlanPartFacts = {
  readonly sessionId: SessionId;
  readonly planId: ArtifactId;
  readonly index: number;
  readonly instructions: string;
  readonly agentId: AgentId | null;
};

export const PLAN_PART_KIND: ObjectKindDefinition<PlanPartActionTarget, PlanPartFacts> = {
  noun: 'plan part',
  facts: ({ target }) => ({
    sessionId: target.sessionId,
    planId: target.planId,
    index: target.index,
    instructions: target.instructions,
    agentId: target.agentId,
  }),
  actions: [
    {
      id: 'planPart.open',
      label: 'Open part',
      icon: PanelRight,
      group: 'open',
      when: () => true,
      run: ({ facts, env }) =>
        env.getState().openDrawer({
          kind: 'plan-part',
          sessionId: facts.sessionId,
          payload: { planId: facts.planId, index: facts.index },
        }),
    },
    {
      id: 'planPart.agent',
      label: 'Open its agent',
      icon: CONCEPT_ICONS.agents,
      group: 'open',
      when: ({ facts }) => facts.agentId !== null,
      run: ({ facts, env }) => {
        if (facts.agentId !== null) {
          env.getState().navigate({
            to: agentPlace({ sessionId: facts.sessionId, agentId: facts.agentId }),
          });
        }
      },
    },
    {
      id: 'planPart.copyInstructions',
      label: 'Copy instructions',
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.instructions.trim() !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.instructions }),
    },
  ],
};
